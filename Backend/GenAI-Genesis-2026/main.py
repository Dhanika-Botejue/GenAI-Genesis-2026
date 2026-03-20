import os
import time
import json
import html
import uuid
import logging
import tempfile
import threading
import queue
import pathlib
import re
from datetime import datetime
from typing import Any

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel

from ibm_watson import SpeechToTextV1, TextToSpeechV1
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

from audio_features import extract_acoustic_features
from speech_analysis import analyze_audio
from llm_reasoning import ask_watsonx
from voice_chatbot import (
    NurseCheckIn,
    MicrophoneStream,
    SeniorCareCallback,
    speak,
    response_worker,
    STT_MODEL,
    TTS_VOICE,
    MIC_SAMPLE_RATE,
    MIC_CHANNELS,
    END_OF_PHRASE_SILENCE,
    wrap_in_ssml,
)

from dotenv import load_dotenv
import pyaudio
from ibm_watson.websocket import AudioSource

load_dotenv()
log = logging.getLogger(__name__)

try:
    import db as db_service

    _DB_AVAILABLE = True
    _DB_IMPORT_ERROR = None
except Exception as exc:
    db_service = None
    _DB_AVAILABLE = False
    _DB_IMPORT_ERROR = exc

_DB_REQUIRED = bool(os.getenv("MONGODB_URI", "").strip())

BASE_DIR = pathlib.Path(__file__).resolve().parent
TWILIO_AUDIO_DIR = BASE_DIR / "twilio_audio"
TWILIO_AUDIO_DIR.mkdir(exist_ok=True)

SUPPORTED_MODES = {"daily_checkin", "physician_intake", "fall_checkin"}
_PROMPT_AUDIO_CACHE: dict[str, str] = {}


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


DEMO_CALL_MODE = _is_truthy(os.getenv("DEMO_CALL_MODE", "1"))
DEFAULT_NEW_PATIENT_ROOM = (os.getenv("DOCTOR_DEFAULT_ROOM") or "102").strip() or "102"
DEMO_CALL_STEP_SECONDS = 3.0
DEMO_CALL_SCRIPT = [
    {
        "question": "Is there anything I can help you with today?",
        "answer": "I am feeling a migraine and shortness of breath.",
    },
    {
        "question": "On a scale of 1-10 how much pain are you feeling?",
        "answer": "My head hurts around a 5 and I my breathing diffuculty is around an 8.",
    },
    {
        "question": "Anything else?",
        "answer": "No",
    },
]


def _normalize_mode(mode: str | None) -> str:
    candidate = (mode or "daily_checkin").strip().lower()
    return candidate if candidate in SUPPORTED_MODES else "daily_checkin"


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing required env var: {name}")
    return value


def _public_url(path: str) -> str:
    base = _require_env("PUBLIC_BASE_URL").rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _extract_transcript(stt_response: dict[str, Any]) -> str:
    results = stt_response.get("results", [])
    return " ".join(
        r["alternatives"][0]["transcript"].strip()
        for r in results
        if r.get("alternatives")
    ).strip()


def _questions_for_mode(mode: str) -> list[tuple[str, str]]:
    if mode == "physician_intake":
        return NurseCheckIn.PHYSICIAN_QUESTIONS
    if mode == "fall_checkin":
        return NurseCheckIn.FALL_QUESTIONS
    return NurseCheckIn.DAILY_QUESTIONS


def _clear_room_assignment_for_other_patients(room_number: str, except_patient_id: str) -> None:
    normalized_room = room_number.strip()
    if not normalized_room:
        return

    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        db.residents.update_many(
            {"room_number": normalized_room, "_id": {"$ne": except_patient_id}},
            {
                "$unset": {"room_number": ""},
                "$set": {"updated_at": datetime.utcnow()},
            },
        )
        return

    for patient_id, patient in list(_memory_patients.items()):
        if patient_id == except_patient_id:
            continue
        if str(patient.get("room_number") or "").strip() == normalized_room:
            patient.pop("room_number", None)
            patient["updated_at"] = datetime.utcnow()


def _build_demo_answers(count: int) -> list[dict[str, str]]:
    return [
        {"question": entry["question"], "answer": entry["answer"]}
        for entry in DEMO_CALL_SCRIPT[:count]
    ]


def _build_demo_history(count: int) -> list[dict[str, Any]]:
    return [
        {
            "question": entry["question"],
            "transcript": entry["answer"],
            "classification": {
                "type": "normal",
                "short_followup": "",
                "reason": "demo_script",
            },
        }
        for entry in DEMO_CALL_SCRIPT[:count]
    ]


def _build_demo_raw_transcript(count: int) -> str:
    lines: list[str] = []
    for entry in DEMO_CALL_SCRIPT[:count]:
        lines.append(f"Q: {entry['question']}")
        lines.append(f"A: {entry['answer']}")
    return "\n".join(lines) + ("\n" if lines else "")


def _maybe_progress_demo_session(session_id: str, live_state: dict[str, Any] | None) -> dict[str, Any] | None:
    if not live_state or not live_state.get("demo_mode"):
        return live_state

    started_at = float(live_state.get("demo_started_at") or time.time())
    elapsed = max(0.0, time.time() - started_at)
    answer_count = min(int(elapsed // DEMO_CALL_STEP_SECONDS), len(DEMO_CALL_SCRIPT))

    live_state["questions"] = [entry["question"] for entry in DEMO_CALL_SCRIPT]
    live_state["answers"] = _build_demo_answers(answer_count)
    live_state["history"] = _build_demo_history(answer_count)
    live_state["phase"] = "questions" if answer_count > 0 else "greeting"
    live_state["question_idx"] = min(answer_count, len(DEMO_CALL_SCRIPT) - 1)

    if answer_count >= len(DEMO_CALL_SCRIPT):
        live_state["status"] = "completed"
        live_state["call_status"] = "completed"
        live_state["completed_at"] = live_state.get("completed_at") or datetime.utcnow()

        if not live_state.get("demo_finalized"):
            updates = {
                "status": "completed",
                "call_status": "completed",
                "raw_transcript": _build_demo_raw_transcript(len(DEMO_CALL_SCRIPT)),
                "history": _build_demo_history(len(DEMO_CALL_SCRIPT)),
                "answers": _build_demo_answers(len(DEMO_CALL_SCRIPT)),
                "completed_at": datetime.utcnow(),
                "ended_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            if _DB_AVAILABLE or _DB_REQUIRED:
                db = _db_or_503()
                db.ai_sessions.update_one({"_id": session_id}, {"$set": updates})
            else:
                session = _memory_sessions.get(session_id)
                if session is not None:
                    session.update(updates)

            live_state["demo_finalized"] = True
    else:
        live_state["status"] = "in_progress"
        live_state["call_status"] = "in_progress"

    return live_state


def _intro_for_mode(mode: str) -> str:
    if mode == "physician_intake":
        return "Hello. I will ask a few short questions for your doctor visit."
    if mode == "fall_checkin":
        return "Hello. Help is on the way. I need a few quick safety answers."
    return "Hello. This is your daily health check-in."


def _synthesize_prompt_to_public_wav(text: str) -> str:
    cache_enabled = _is_truthy(os.getenv("TWILIO_CACHE_PROMPT_AUDIO", "1"))
    cache_key = " ".join(text.split())
    if cache_enabled and cache_key in _PROMPT_AUDIO_CACHE:
        return _PROMPT_AUDIO_CACHE[cache_key]

    tts_client = build_tts_client()
    response = tts_client.synthesize(
        text=wrap_in_ssml(text),
        accept="audio/wav",
        voice=TTS_VOICE,
    ).get_result()

    filename = f"prompt_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}.wav"
    out_path = TWILIO_AUDIO_DIR / filename
    out_path.write_bytes(response.content)

    public_url = _public_url(f"/twilio/audio/{filename}")
    if cache_enabled:
        if len(_PROMPT_AUDIO_CACHE) >= 200:
            _PROMPT_AUDIO_CACHE.pop(next(iter(_PROMPT_AUDIO_CACHE)))
        _PROMPT_AUDIO_CACHE[cache_key] = public_url
    return public_url


def _prompt_node(text: str) -> str:
    """
    Prefer IBM TTS audio playback for Twilio calls.
    If IBM TTS fails (e.g., credentials/permissions), fall back to Twilio <Say>
    so the call flow keeps running instead of returning a 500.
    """
    try:
        prompt_audio_url = _synthesize_prompt_to_public_wav(text)
        return f"<Play>{html.escape(prompt_audio_url)}</Play>"
    except Exception:
        safe = html.escape(text)
        return f'<Say voice="alice">{safe}</Say>'


def _build_record_twiml(prompt_text: str, action_path: str) -> str:
    timeout_secs = max(1, _env_int("TWILIO_RECORD_TIMEOUT_SECONDS", 2))
    max_length_secs = max(5, _env_int("TWILIO_RECORD_MAX_LENGTH_SECONDS", 20))
    trim_mode = os.getenv("TWILIO_RECORD_TRIM", "trim-silence")
    if trim_mode not in {"trim-silence", "do-not-trim"}:
        trim_mode = "trim-silence"

    action_url = _public_url(action_path)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"{_prompt_node(prompt_text)}"
        f"<Record action=\"{html.escape(action_url, quote=True)}\" method=\"POST\" "
        f"playBeep=\"true\" timeout=\"{timeout_secs}\" "
        f"maxLength=\"{max_length_secs}\" trim=\"{trim_mode}\" />"
        f"<Redirect method=\"POST\">{html.escape(action_url)}</Redirect>"
        "</Response>"
    )


def _build_hangup_twiml(final_text: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"{_prompt_node(final_text)}"
        "<Hangup/>"
        "</Response>"
    )


def _fetch_twilio_recording_wav(recording_url: str) -> bytes:
    account_sid = _require_env("TWILIO_ACCOUNT_SID")
    auth_token = _require_env("TWILIO_AUTH_TOKEN")

    wav_url = recording_url if recording_url.endswith(".wav") else f"{recording_url}.wav"
    with httpx.Client(timeout=20.0) as client:
        response = client.get(wav_url, auth=(account_sid, auth_token))
        response.raise_for_status()
        return response.content


def _transcribe_twilio_recording(recording_url: str) -> str:
    wav_bytes = _fetch_twilio_recording_wav(recording_url)
    stt_client = build_stt_client()
    phone_model = os.getenv("TWILIO_STT_MODEL", "en-US_Telephony")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
        temp_wav.write(wav_bytes)
        temp_path = temp_wav.name

    try:
        with open(temp_path, "rb") as audio_file:
            stt_response = stt_client.recognize(
                audio=audio_file,
                content_type="audio/wav",
                model=phone_model,
                smart_formatting=True,
                word_confidence=True,
            ).get_result()
        transcript = _extract_transcript(stt_response)

        # Fallback to the existing model if telephony returns no transcript.
        if not transcript and phone_model != STT_MODEL:
            with open(temp_path, "rb") as audio_file:
                fallback_response = stt_client.recognize(
                    audio=audio_file,
                    content_type="audio/wav",
                    model=STT_MODEL,
                    smart_formatting=True,
                    word_confidence=True,
                ).get_result()
            transcript = _extract_transcript(fallback_response)

        return transcript
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def _classify_with_gpt(question: str, transcript: str, mode: str) -> dict[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "type": "normal",
            "short_followup": "",
            "reason": "OPENAI_API_KEY not set",
        }

    prompt = (
        "You are triaging spoken answers in a nursing-home check-in phone call. "
        "Classify the answer relative to the expected question. "
        "Return JSON only with keys: type, short_followup, reason. "
        "type must be one of: normal, interruption, unexpected. "
        "short_followup must be <= 12 words and calm. "
        "If type is normal, short_followup should be an empty string."
    )

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    f"Mode: {mode}\n"
                    f"Expected question: {question}\n"
                    f"Resident answer: {transcript}\n"
                    "Return only JSON."
                ),
            },
        ],
    }

    try:
        timeout_secs = _env_float("OPENAI_CLASSIFICATION_TIMEOUT_SECONDS", 3.5)
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout_secs,
            )
            response.raise_for_status()

        content = response.json()["choices"][0]["message"]["content"].strip()
        parsed = json.loads(content)
        classified = parsed.get("type", "normal")
        if classified not in {"normal", "interruption", "unexpected"}:
            classified = "unexpected"

        return {
            "type": classified,
            "short_followup": (parsed.get("short_followup", "") or "").strip(),
            "reason": (parsed.get("reason", "") or "").strip(),
        }
    except Exception:
        return {
            "type": "normal",
            "short_followup": "",
            "reason": "fallback_on_error",
        }


def _quick_interruption_classifier(transcript: str) -> dict[str, str]:
    t = transcript.lower()
    if any(p in t for p in ["repeat", "say that again", "come again", "pardon"]):
        return {
            "type": "interruption",
            "short_followup": "Sure, I will repeat the question.",
            "reason": "repeat_request",
        }
    if any(p in t for p in ["wait", "hold on", "one second", "give me a second"]):
        return {
            "type": "interruption",
            "short_followup": "No problem, take your time.",
            "reason": "pause_request",
        }
    return {
        "type": "normal",
        "short_followup": "",
        "reason": "fast_path",
    }

# ── IBM Watson clients ────────────────────────────────────────────────────────

def build_stt_client() -> SpeechToTextV1:
    if not os.getenv("STT_API_KEY") or not os.getenv("STT_URL"):
        raise RuntimeError("IBM Watson STT is not configured.")
    auth = IAMAuthenticator(os.getenv("STT_API_KEY"))
    stt  = SpeechToTextV1(authenticator=auth)
    stt.set_service_url(os.getenv("STT_URL"))
    return stt

def build_tts_client() -> TextToSpeechV1:
    if not os.getenv("TTS_API_KEY") or not os.getenv("TTS_URL"):
        raise RuntimeError("IBM Watson TTS is not configured.")
    auth = IAMAuthenticator(os.getenv("TTS_API_KEY"))
    tts  = TextToSpeechV1(authenticator=auth)
    tts.set_service_url(os.getenv("TTS_URL"))
    return tts


# ── Voice chatbot state (runs in background threads) ─────────────────────────

_voice_state: dict = {}
_twilio_calls: dict[str, dict[str, Any]] = {}


def start_voice_chatbot() -> None:
    """Start the live microphone voice chatbot in background threads."""
    stt_client = build_stt_client()
    tts_client = build_tts_client()

    response_queue: queue.Queue = queue.Queue()
    stop_event  = threading.Event()
    tts_active  = threading.Event()

    pa  = pyaudio.PyAudio()
    mic = MicrophoneStream(pa, tts_active)

    worker = threading.Thread(
        target=response_worker,
        args=(response_queue, tts_client, tts_active, stop_event),
        daemon=True,
        name="ResponseWorker",
    )
    worker.start()

    _voice_state.update({
        "stt_client":     stt_client,
        "tts_client":     tts_client,
        "response_queue": response_queue,
        "stop_event":     stop_event,
        "tts_active":     tts_active,
        "pa":             pa,
        "mic":            mic,
        "worker":         worker,
    })

    # STT WebSocket loop in its own thread so it doesn't block FastAPI
    def stt_loop():
        while not stop_event.is_set():
            audio_source = AudioSource(mic, is_recording=True)
            callback     = SeniorCareCallback(response_queue)
            try:
                stt_client.recognize_using_websocket(
                    audio=audio_source,
                    content_type=f"audio/l16; rate={MIC_SAMPLE_RATE}; channels={MIC_CHANNELS}",
                    model=STT_MODEL,
                    recognize_callback=callback,
                    interim_results=True,
                    end_of_phrase_silence_time=END_OF_PHRASE_SILENCE,
                    smart_formatting=True,
                    word_confidence=True,
                    timestamps=False,
                    background_audio_suppression=0.5,
                    speech_detector_sensitivity=0.4,
                )
            except Exception as exc:
                if not stop_event.is_set():
                    stop_event.wait(timeout=1.0)

    stt_thread = threading.Thread(target=stt_loop, daemon=True, name="STTLoop")
    stt_thread.start()
    _voice_state["stt_thread"] = stt_thread


def stop_voice_chatbot() -> None:
    """Cleanly shut down the voice chatbot."""
    stop_event = _voice_state.get("stop_event")
    if stop_event:
        stop_event.set()

    mic = _voice_state.get("mic")
    if mic:
        mic.close()

    worker = _voice_state.get("worker")
    if worker:
        worker.join(timeout=5)

    pa = _voice_state.get("pa")
    if pa:
        pa.terminate()


# ── App lifespan (replaces @app.on_event) ────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if _DB_AVAILABLE:
        try:
            db_service.init_db()
        except Exception as exc:
            log.warning("Database init failed: %s", exc)

    enable_local_voice = _is_truthy(os.getenv("ENABLE_LOCAL_VOICE_CHATBOT"))
    if enable_local_voice:
        try:
            start_voice_chatbot()
        except Exception as exc:
            log.warning("Local voice chatbot was not started: %s", exc)
    yield
    if enable_local_voice:
        stop_voice_chatbot()


app = FastAPI(lifespan=lifespan)

# CORS — required when the Next.js frontend is hosted on a different origin (e.g. Vercel).
# Set ALLOWED_ORIGINS in the backend .env to a comma-separated list of allowed origins,
# e.g. "https://your-app.vercel.app" for production or "*" for development.
_allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
_allowed_origins = [o.strip() for o in _allowed_origins_raw.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/twilio/audio", StaticFiles(directory=str(TWILIO_AUDIO_DIR)), name="twilio_audio")


class StartCallRequest(BaseModel):
    to_number: str
    mode: str = "daily_checkin"


class CreatePatientRequest(BaseModel):
    firstName: str
    lastName: str
    phone: str


class EmergencyContactPayload(BaseModel):
    name: str = ""
    relationship: str = ""
    phone: str = ""


class UpdatePatientRequest(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    phone: str | None = None
    dateOfBirth: str | None = None
    room: str | None = None
    primaryDiagnosis: str | None = None
    secondaryDiagnoses: list[str] | None = None
    allergies: list[str] | None = None
    medications: list[str] | None = None
    emergencyContact: EmergencyContactPayload | None = None
    notes: str | None = None


class InitiatePatientCallRequest(BaseModel):
    patient_id: str
    questions: list[str]


def _db_or_503():
    if not _DB_AVAILABLE:
        hint = (
            " Install database dependencies (pymongo, certifi) and verify MONGODB_URI."
            if _DB_REQUIRED
            else ""
        )
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {_DB_IMPORT_ERROR}.{hint}",
        )
    return db_service.get_db()


def _jsonify_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_jsonify_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _jsonify_value(v) for k, v in value.items()}
    return value


def _clean_string_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    cleaned: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if normalized:
            cleaned.append(normalized)
    return cleaned


def _normalize_emergency_contact(contact: Any) -> dict[str, str]:
    if not isinstance(contact, dict):
        return {"name": "", "relationship": "", "phone": ""}
    return {
        "name": str(contact.get("name") or "").strip(),
        "relationship": str(contact.get("relationship") or contact.get("relation") or "").strip(),
        "phone": str(contact.get("phone") or "").strip(),
    }


def _format_medication_label(medication: dict[str, Any]) -> str:
    name = str(medication.get("name") or "").strip()
    dosage = str(medication.get("dosage") or "").strip()
    frequency = str(medication.get("frequency") or "").strip()
    parts = [part for part in [name, dosage] if part]
    label = " ".join(parts)
    if frequency:
        return f"{label} ({frequency})" if label else frequency
    return label


def _normalize_patient_doc(doc: dict[str, Any]) -> dict[str, Any]:
    full_name = (doc.get("full_name") or "").strip()
    first_name = (doc.get("first_name") or "").strip()
    last_name = (doc.get("last_name") or "").strip()
    diagnoses = _clean_string_list(doc.get("diagnoses"))
    medications = _clean_string_list(doc.get("medications"))

    if not first_name and not last_name and full_name:
        parts = full_name.split()
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

    normalized = {
        "_id": str(doc.get("_id")),
        "id": str(doc.get("_id")),
        "firstName": first_name,
        "lastName": last_name,
        "fullName": full_name or f"{first_name} {last_name}".strip(),
        "phone": doc.get("phone_number", ""),
        "dateOfBirth": str(doc.get("date_of_birth") or "").strip(),
        "room": str(doc.get("room") or doc.get("room_number") or "").strip(),
        "primaryDiagnosis": diagnoses[0] if diagnoses else "",
        "secondaryDiagnoses": diagnoses[1:] if len(diagnoses) > 1 else [],
        "allergies": _clean_string_list(doc.get("allergies")),
        "medications": medications,
        "emergencyContact": _normalize_emergency_contact(doc.get("emergency_contact")),
        "notes": str(doc.get("notes") or "").strip(),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }
    return _jsonify_value(normalized)


def _parse_session_transcript(raw_transcript: str | None) -> tuple[str, list[dict[str, str]]]:
    greeting_notes = ""
    answers: list[dict[str, str]] = []
    pending_question = ""

    for raw_line in (raw_transcript or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("GREETING_RESPONSE:"):
            greeting_notes = line.removeprefix("GREETING_RESPONSE:").strip()
            pending_question = ""
            continue
        if line.startswith("Q:"):
            pending_question = line.removeprefix("Q:").strip()
            continue
        if line.startswith("A:") and pending_question:
            answers.append(
                {
                    "question": pending_question,
                    "answer": line.removeprefix("A:").strip(),
                }
            )
            pending_question = ""

    return greeting_notes, answers


def _normalize_session_doc(doc: dict[str, Any], live_state: dict[str, Any] | None = None) -> dict[str, Any]:
    live_state = live_state or {}
    call_config = doc.get("call_config") if isinstance(doc.get("call_config"), dict) else {}
    parsed_greeting_notes, parsed_answers = _parse_session_transcript(doc.get("raw_transcript"))

    live_answers: list[dict[str, str]] = []
    for answer in live_state.get("answers") or []:
        if not isinstance(answer, dict):
            continue
        question = str(answer.get("question") or "").strip()
        answer_text = str(answer.get("answer") or "").strip()
        if question and answer_text:
            live_answers.append({"question": question, "answer": answer_text})

    normalized_questions = [
        str(question).strip()
        for question in (call_config.get("questions") or [])
        if str(question).strip()
    ]
    if not normalized_questions:
        source_answers = live_answers or parsed_answers
        normalized_questions = [answer["question"] for answer in source_answers if answer.get("question")]

    live_history = live_state.get("history") if isinstance(live_state.get("history"), list) else None
    doc_history = doc.get("history") if isinstance(doc.get("history"), list) else None
    raw_transcript = str(doc.get("raw_transcript") or "")
    transcript_lines = [line for line in raw_transcript.splitlines() if line.strip()]

    normalized = {
        "_id": str(doc.get("_id") or live_state.get("session_id") or ""),
        "id": str(doc.get("_id") or live_state.get("session_id") or ""),
        "patient_id": str(doc.get("resident_id") or live_state.get("patient_id") or ""),
        "resident_id": str(doc.get("resident_id") or live_state.get("patient_id") or ""),
        "questions_asked": normalized_questions,
        "answers": live_answers or parsed_answers,
        "history": live_history or doc_history or [],
        "greeting_used": str(live_state.get("greeting") or call_config.get("greeting") or "").strip(),
        "greeting_notes": str(live_state.get("greeting_notes") or parsed_greeting_notes or "").strip(),
        "status": str(doc.get("status") or ("in_progress" if live_state else "completed")),
        "call_status": str(doc.get("call_status") or live_state.get("call_status") or "").strip(),
        "raw_transcript": raw_transcript,
        "transcript_lines": transcript_lines,
        "created_at": doc.get("created_at") or doc.get("started_at") or doc.get("updated_at"),
        "updated_at": doc.get("updated_at"),
        "completed_at": doc.get("completed_at") or doc.get("ended_at"),
        "ended_at": doc.get("ended_at"),
    }
    return _jsonify_value(normalized)


_memory_patients: dict[str, dict[str, Any]] = {}
_memory_sessions: dict[str, dict[str, Any]] = {}
_memory_history_by_patient: dict[str, list[dict[str, Any]]] = {}


def _ensure_memory_seed() -> None:
    if _memory_patients:
        return
    patient_id = "demo-patient-001"
    _memory_patients[patient_id] = {
        "_id": patient_id,
        "first_name": "Eleanor",
        "last_name": "Whitfield",
        "full_name": "Eleanor Whitfield",
        "phone_number": "+16479150931",
        "created_at": datetime.utcnow(),
    }
    _memory_history_by_patient[patient_id] = []


def _generate_greeting(first_name: str, past_sessions: list[dict[str, Any]]) -> str:
    if past_sessions:
        return (
            f"Hello {first_name}. It is good to speak with you again. "
            "Thank you for taking this call."
        )
    return (
        f"Hello {first_name}. This is your care check in assistant. "
        "Thank you for taking this call."
    )


def _asked_how_are_you(text: str) -> bool:
    lowered = text.lower()
    patterns = [
        "how are you",
        "how about you",
        "and you",
        "howre you",
        "how you doing",
        "yourself",
        "what about you",
    ]
    normalized = re.sub(r"[^a-z0-9\s]", "", lowered)
    return any(p in normalized for p in patterns)


def _sentiment_transition(answer_text: str) -> str:
    t = answer_text.lower()
    if any(w in t for w in ["good", "great", "better", "fine", "okay", "ok"]):
        return "That is great to hear."
    if any(w in t for w in ["pain", "bad", "worse", "dizzy", "tired", "sad", "anxious"]):
        return "I am sorry to hear that."
    return "Thank you for sharing that."


def _append_session_transcript(session_id: str, line: str) -> None:
    if not _DB_AVAILABLE:
        session = _memory_sessions.get(session_id)
        if session is not None:
            session["raw_transcript"] = (session.get("raw_transcript") or "") + line
            session["updated_at"] = datetime.utcnow()
        return
    db = db_service.get_db()
    existing = db.ai_sessions.find_one({"_id": session_id})
    if not existing:
        return
    transcript = (existing.get("raw_transcript") or "") + line
    db.ai_sessions.update_one(
        {"_id": session_id},
        {"$set": {"raw_transcript": transcript, "updated_at": datetime.utcnow()}},
    )


def _complete_session(session_id: str, call_status: str = "completed") -> None:
    if not _DB_AVAILABLE:
        session = _memory_sessions.get(session_id)
        if session is not None:
            session["status"] = "completed"
            session["call_status"] = call_status
            session["ended_at"] = datetime.utcnow()
            session["completed_at"] = session["ended_at"]
        return
    db = db_service.get_db()
    db.ai_sessions.update_one(
        {"_id": session_id},
        {
            "$set": {
                "status": "completed",
                "call_status": call_status,
                "ended_at": datetime.utcnow(),
                "completed_at": datetime.utcnow(),
            }
        },
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "AI NLP service is running"}


@app.get("/api/patients")
async def list_patients():
    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        patients = list(db.residents.find().sort("created_at", -1))
    else:
        _ensure_memory_seed()
        patients = list(_memory_patients.values())
    return [_normalize_patient_doc(p) for p in patients]


@app.post("/api/patients")
async def create_patient(payload: CreatePatientRequest):
    first_name = payload.firstName.strip()
    last_name = payload.lastName.strip()
    phone = payload.phone.strip()

    if not first_name or not last_name or not phone:
        raise HTTPException(status_code=400, detail="firstName, lastName, and phone are required")

    patient_id = str(uuid.uuid4())
    doc = {
        "_id": patient_id,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": f"{first_name} {last_name}",
        "phone_number": phone,
        "room_number": DEFAULT_NEW_PATIENT_ROOM,
        "created_at": datetime.utcnow(),
    }

    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        if db.residents.find_one({"phone_number": phone}):
            raise HTTPException(status_code=409, detail="A patient with this phone number already exists")
        db.residents.insert_one(doc)
        _clear_room_assignment_for_other_patients(DEFAULT_NEW_PATIENT_ROOM, patient_id)
    else:
        _ensure_memory_seed()
        if any(p.get("phone_number") == phone for p in _memory_patients.values()):
            raise HTTPException(status_code=409, detail="A patient with this phone number already exists")
        _memory_patients[patient_id] = doc
        _memory_history_by_patient[patient_id] = []
        _clear_room_assignment_for_other_patients(DEFAULT_NEW_PATIENT_ROOM, patient_id)

    return _normalize_patient_doc(doc)


@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: str):
    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        patient = db.residents.find_one({"_id": patient_id})
        if patient and not patient.get("medications"):
            medications = list(db.medications.find({"resident_id": patient_id, "is_active": True}))
            if medications:
                patient = {**patient, "medications": [_format_medication_label(medication) for medication in medications]}
    else:
        _ensure_memory_seed()
        patient = _memory_patients.get(patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _normalize_patient_doc(patient)


@app.patch("/api/patients/{patient_id}")
async def update_patient(patient_id: str, payload: UpdatePatientRequest):
    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        existing = db.residents.find_one({"_id": patient_id})
    else:
        _ensure_memory_seed()
        existing = _memory_patients.get(patient_id)

    if not existing:
        raise HTTPException(status_code=404, detail="Patient not found")

    updates: dict[str, Any] = {}
    if payload.firstName is not None:
        updates["first_name"] = payload.firstName.strip()
    if payload.lastName is not None:
        updates["last_name"] = payload.lastName.strip()
    if payload.phone is not None:
        new_phone = payload.phone.strip()
        if _DB_AVAILABLE or _DB_REQUIRED:
            other = db.residents.find_one({"phone_number": new_phone, "_id": {"$ne": patient_id}})
            if other:
                raise HTTPException(status_code=409, detail="A patient with this phone number already exists")
        else:
            for pid, patient in _memory_patients.items():
                if pid != patient_id and patient.get("phone_number") == new_phone:
                    raise HTTPException(status_code=409, detail="A patient with this phone number already exists")
        updates["phone_number"] = new_phone
    if payload.dateOfBirth is not None:
        updates["date_of_birth"] = payload.dateOfBirth.strip()
    if payload.room is not None:
        updates["room_number"] = payload.room.strip()
    if payload.allergies is not None:
        updates["allergies"] = _clean_string_list(payload.allergies)
    if payload.medications is not None:
        updates["medications"] = _clean_string_list(payload.medications)
    if payload.notes is not None:
        updates["notes"] = payload.notes.strip()
    if payload.emergencyContact is not None:
        updates["emergency_contact"] = {
            "name": payload.emergencyContact.name.strip(),
            "relation": payload.emergencyContact.relationship.strip(),
            "relationship": payload.emergencyContact.relationship.strip(),
            "phone": payload.emergencyContact.phone.strip(),
        }

    current_diagnoses = _clean_string_list(existing.get("diagnoses"))
    primary_diagnosis = (
        payload.primaryDiagnosis.strip()
        if payload.primaryDiagnosis is not None
        else (current_diagnoses[0] if current_diagnoses else "")
    )
    secondary_diagnoses = (
        _clean_string_list(payload.secondaryDiagnoses)
        if payload.secondaryDiagnoses is not None
        else current_diagnoses[1:]
    )
    if payload.primaryDiagnosis is not None or payload.secondaryDiagnoses is not None:
        updates["diagnoses"] = [
            diagnosis
            for diagnosis in [primary_diagnosis, *secondary_diagnoses]
            if diagnosis
        ]

    first_name = updates.get("first_name", existing.get("first_name", ""))
    last_name = updates.get("last_name", existing.get("last_name", ""))
    updates["full_name"] = f"{first_name} {last_name}".strip() or existing.get("full_name", "")
    updates["updated_at"] = datetime.utcnow()

    if _DB_AVAILABLE or _DB_REQUIRED:
        db.residents.update_one({"_id": patient_id}, {"$set": updates})
        if updates.get("room_number"):
            _clear_room_assignment_for_other_patients(str(updates["room_number"]), patient_id)
        updated = db.residents.find_one({"_id": patient_id})
    else:
        _memory_patients[patient_id] = {**existing, **updates}
        if updates.get("room_number"):
            _clear_room_assignment_for_other_patients(str(updates["room_number"]), patient_id)
        updated = _memory_patients[patient_id]

    return _normalize_patient_doc(updated)


@app.delete("/api/patients/{patient_id}")
async def delete_patient(patient_id: str):
    for key, state in list(_twilio_calls.items()):
        if state.get("patient_id") == patient_id:
            _twilio_calls.pop(key, None)

    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        existing = db.residents.find_one({"_id": patient_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Patient not found")
        db.residents.delete_one({"_id": patient_id})
        db.ai_sessions.delete_many({"resident_id": patient_id})
        db.medications.delete_many({"resident_id": patient_id})
    else:
        _ensure_memory_seed()
        existing = _memory_patients.pop(patient_id, None)
        _memory_history_by_patient.pop(patient_id, None)
        for session_id, session in list(_memory_sessions.items()):
            if session.get("resident_id") == patient_id:
                _memory_sessions.pop(session_id, None)
        if not existing:
            raise HTTPException(status_code=404, detail="Patient not found")

    return {"message": "Patient deleted"}


@app.get("/api/patients/{patient_id}/history")
async def patient_history(patient_id: str):
    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        history = list(
            db.ai_sessions.find({"resident_id": patient_id}).sort("created_at", -1).limit(100)
        )
    else:
        _ensure_memory_seed()
        history = list(_memory_history_by_patient.get(patient_id, []))

    return [_normalize_session_doc(h, _twilio_calls.get(str(h.get("_id")))) for h in history]


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    live_state = _maybe_progress_demo_session(session_id, _twilio_calls.get(session_id))

    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        session = db.ai_sessions.find_one({"_id": session_id})
    else:
        _ensure_memory_seed()
        session = _memory_sessions.get(session_id)

    if not session and not live_state:
        raise HTTPException(status_code=404, detail="Session not found")

    session_doc = session or {
        "_id": session_id,
        "resident_id": live_state.get("patient_id", "") if live_state else "",
        "status": "in_progress",
        "created_at": datetime.utcnow(),
        "call_config": {
            "questions": live_state.get("questions", []) if live_state else [],
            "greeting": live_state.get("greeting", "") if live_state else "",
        },
        "raw_transcript": "",
    }
    return _normalize_session_doc(session_doc, live_state)


@app.post("/api/call")
async def initiate_patient_call(payload: InitiatePatientCallRequest):
    patient_id = (payload.patient_id or "").strip()
    questions = [q.strip() for q in payload.questions if q and q.strip()]

    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    if not questions and not DEMO_CALL_MODE:
        raise HTTPException(status_code=400, detail="At least one question is required")

    if _DB_AVAILABLE or _DB_REQUIRED:
        db = _db_or_503()
        patient = db.residents.find_one({"_id": patient_id})
    else:
        _ensure_memory_seed()
        patient = _memory_patients.get(patient_id)

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    first_name = (patient.get("first_name") or patient.get("full_name", "Resident").split()[0]).strip() or "Resident"
    phone = (patient.get("phone_number") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Patient phone number is missing")

    if _DB_AVAILABLE or _DB_REQUIRED:
        past_sessions = list(
            db.ai_sessions.find({"resident_id": patient_id}).sort("created_at", -1).limit(5)
        )
    else:
        past_sessions = list(_memory_history_by_patient.get(patient_id, []))[-5:]

    greeting = _generate_greeting(first_name, past_sessions)
    selected_questions = [entry["question"] for entry in DEMO_CALL_SCRIPT] if DEMO_CALL_MODE else questions

    session_id = str(uuid.uuid4())
    session_doc = {
        "_id": session_id,
        "resident_id": patient_id,
        "trigger_type": "twilio_outbound",
        "status": "in_progress",
        "raw_transcript": "",
        "call_config": {"questions": selected_questions, "greeting": greeting},
        "created_at": datetime.utcnow(),
    }

    if _DB_AVAILABLE or _DB_REQUIRED:
        db.ai_sessions.insert_one(session_doc)
    else:
        _memory_sessions[session_id] = session_doc
        _memory_history_by_patient.setdefault(patient_id, []).insert(0, session_doc)

    _twilio_calls[session_id] = {
        "session_id": session_id,
        "patient_id": patient_id,
        "patient_phone": phone,
        "patient_name": first_name,
        "questions": selected_questions,
        "greeting": greeting,
        "phase": "greeting",
        "question_idx": 0,
        "answers": [],
        "history": [],
    }

    if DEMO_CALL_MODE:
        demo_call_sid = f"demo-{uuid.uuid4().hex[:12]}"
        _twilio_calls[session_id].update(
            {
                "call_sid": demo_call_sid,
                "demo_mode": True,
                "demo_started_at": time.time(),
                "status": "in_progress",
                "call_status": "queued",
            }
        )
        return {
            "message": "Demo call initiated",
            "call_sid": demo_call_sid,
            "session_id": session_id,
        }

    account_sid = _require_env("TWILIO_ACCOUNT_SID")
    auth_token = _require_env("TWILIO_AUTH_TOKEN")
    from_number = _require_env("TWILIO_FROM_NUMBER")

    webhook_url = _public_url(f"/twilio/voice/answer?session_id={session_id}&phase=greeting")
    status_url = _public_url(f"/twilio/status?session_id={session_id}")

    call_data = {
        "To": phone,
        "From": from_number,
        "Url": webhook_url,
        "Method": "POST",
        "StatusCallback": status_url,
        "StatusCallbackEvent": "completed",
        "StatusCallbackMethod": "POST",
    }

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json",
            auth=(account_sid, auth_token),
            data=call_data,
        )

    if response.status_code >= 400:
        _twilio_calls.pop(session_id, None)
        if _DB_AVAILABLE or _DB_REQUIRED:
            db.ai_sessions.update_one(
                {"_id": session_id},
                {"$set": {"status": "failed", "error": response.text, "ended_at": datetime.utcnow()}},
            )
        else:
            session = _memory_sessions.get(session_id)
            if session is not None:
                session["status"] = "failed"
                session["error"] = response.text
                session["ended_at"] = datetime.utcnow()
        raise HTTPException(status_code=502, detail=f"Twilio call creation failed: {response.text}")

    call_payload = response.json()
    call_sid = call_payload.get("sid")

    if call_sid:
        _twilio_calls[session_id]["call_sid"] = call_sid
        _twilio_calls[call_sid] = _twilio_calls[session_id]
        if _DB_AVAILABLE or _DB_REQUIRED:
            db.ai_sessions.update_one({"_id": session_id}, {"$set": {"call_sid": call_sid}})
        else:
            session = _memory_sessions.get(session_id)
            if session is not None:
                session["call_sid"] = call_sid

    return {
        "message": "Call initiated",
        "call_sid": call_sid,
        "session_id": session_id,
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Upload an audio file → get transcript, acoustic analysis, and LLM result.
    Uses IBM Watson STT for transcription.
    """
    temp_path = None

    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # STT — IBM Watson (synchronous, file-based)
        stt_client = build_stt_client()
        with open(temp_path, "rb") as audio_file:
            stt_response = stt_client.recognize(
                audio=audio_file,
                content_type=f"audio/{suffix.lstrip('.')}",
                model="en-US_Multimedia",
                smart_formatting=True,
                word_confidence=True,
            ).get_result()

        # Extract transcript from Watson response
        results = stt_response.get("results", [])
        transcript = " ".join(
            r["alternatives"][0]["transcript"].strip()
            for r in results
            if r.get("alternatives")
        )

        # Acoustic analysis
        acoustic_features = extract_acoustic_features(temp_path)
        speech_analysis   = analyze_audio(acoustic_features)

        # LLM reasoning
        llm_result = ask_watsonx(transcript, speech_analysis)

        # TTS — speak the reply back (non-blocking, fires into voice chatbot worker)
        tts_active = _voice_state.get("tts_active")
        tts_client = _voice_state.get("tts_client")
        if tts_client and tts_active and llm_result.get("tts_reply"):
            threading.Thread(
                target=speak,
                args=(tts_client, llm_result["tts_reply"], tts_active),
                daemon=True,
            ).start()

        return {
            "filename":         file.filename,
            "transcript":       transcript,
            "acoustic_features": acoustic_features,
            "speech_analysis":  speech_analysis,
            "llm_result":       llm_result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/voice/stop")
async def stop_voice():
    """Stop the live voice chatbot."""
    stop_voice_chatbot()
    return {"message": "Voice chatbot stopped"}


@app.get("/voice/status")
async def voice_status():
    """Check if the voice chatbot is running."""
    stop_event = _voice_state.get("stop_event")
    running    = stop_event is not None and not stop_event.is_set()
    return {"voice_chatbot_running": running}


@app.post("/twilio/call/start")
async def start_twilio_call(payload: StartCallRequest):
    """Frontend endpoint to trigger an outbound Twilio check-in call."""
    account_sid = _require_env("TWILIO_ACCOUNT_SID")
    auth_token = _require_env("TWILIO_AUTH_TOKEN")
    from_number = _require_env("TWILIO_FROM_NUMBER")

    mode = _normalize_mode(payload.mode)
    answer_url = _public_url(f"/twilio/voice/answer?mode={mode}")

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json",
            auth=(account_sid, auth_token),
            data={
                "To": payload.to_number,
                "From": from_number,
                "Url": answer_url,
                "Method": "POST",
            },
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Twilio call creation failed: {response.text}")

    data = response.json()
    return {
        "message": "Call initiated",
        "call_sid": data.get("sid"),
        "status": data.get("status"),
        "mode": mode,
    }


@app.post("/twilio/voice/answer")
async def twilio_answer(
    CallSid: str = Form(...),
    From: str = Form(default=""),
    mode: str = "daily_checkin",
    session_id: str | None = None,
    phase: str = "questions",
    question_idx: int = 0,
):
    """Twilio webhook: start call script and ask first question."""
    try:
        if session_id:
            state = _twilio_calls.get(session_id)
            if not state:
                fallback = _build_hangup_twiml("We could not find your call session. Goodbye.")
                return Response(content=fallback, media_type="application/xml")

            state["call_sid"] = CallSid
            state["from"] = From
            _twilio_calls[CallSid] = state

            questions = state.get("questions", [])
            if phase == "greeting":
                greeting_prompt = state.get("greeting") or "Hello. How are you feeling today?"
                action = f"/twilio/voice/recording?session_id={session_id}&phase=greeting&question_idx=0"
                twiml = _build_record_twiml(greeting_prompt, action)
                return Response(content=twiml, media_type="application/xml")

            if question_idx >= len(questions):
                twiml = _build_hangup_twiml("Thank you for your time. Your responses have been recorded. Goodbye.")
                _complete_session(session_id)
                _twilio_calls.pop(session_id, None)
                _twilio_calls.pop(CallSid, None)
                return Response(content=twiml, media_type="application/xml")

            prompt = questions[question_idx]
            action = (
                f"/twilio/voice/recording?session_id={session_id}"
                f"&phase=questions&question_idx={question_idx}"
            )
            twiml = _build_record_twiml(prompt, action)
            return Response(content=twiml, media_type="application/xml")

        mode = _normalize_mode(mode)
        questions = _questions_for_mode(mode)
        if not questions:
            raise ValueError("No question set configured")

        _twilio_calls[CallSid] = {
            "mode": mode,
            "from": From,
            "question_idx": 0,
            "answers": {},
            "history": [],
        }

        first_question = questions[0][1]
        prompt = f"{_intro_for_mode(mode)} {first_question}"
        twiml = _build_record_twiml(prompt, "/twilio/voice/recording")
        return Response(content=twiml, media_type="application/xml")
    except Exception:
        twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Response><Say voice="alice">'
            'We are having trouble starting this check in. Please try again shortly.'
            "</Say><Hangup/></Response>"
        )
        return Response(content=twiml, media_type="application/xml")


@app.post("/twilio/voice/recording")
async def twilio_recording(
    CallSid: str = Form(...),
    RecordingUrl: str | None = Form(default=None),
    RecordingDuration: str | None = Form(default=None),
    session_id: str | None = None,
    phase: str = "questions",
    question_idx: int = 0,
):
    """Twilio webhook: transcribe resident answer with IBM STT and continue flow."""
    try:
        if session_id:
            state = _twilio_calls.get(session_id)
            if not state:
                fallback = _build_hangup_twiml("This call session is no longer active. Goodbye.")
                return Response(content=fallback, media_type="application/xml")

            state["call_sid"] = CallSid
            _twilio_calls[CallSid] = state

            questions = state.get("questions", [])

            if not RecordingUrl:
                if phase == "greeting":
                    retry_prompt = state.get("greeting", "Hello. How are you feeling today?")
                    action = f"/twilio/voice/recording?session_id={session_id}&phase=greeting&question_idx=0"
                else:
                    question_text = questions[question_idx] if question_idx < len(questions) else ""
                    retry_prompt = f"I did not catch that. {question_text}".strip()
                    action = (
                        f"/twilio/voice/recording?session_id={session_id}"
                        f"&phase=questions&question_idx={question_idx}"
                    )
                twiml = _build_record_twiml(retry_prompt, action)
                return Response(content=twiml, media_type="application/xml")

            try:
                transcript = _transcribe_twilio_recording(RecordingUrl)
            except Exception as exc:
                log.warning("Custom call transcription failed (session=%s): %s", session_id, exc)
                transcript = ""

            log.info(
                "Custom call recording (session=%s, phase=%s, idx=%s, duration=%s, transcript=%s)",
                session_id,
                phase,
                question_idx,
                RecordingDuration or "unknown",
                transcript or "<empty>",
            )

            if not transcript:
                if phase == "greeting":
                    retry_prompt = (
                        "I could not hear you clearly. Please speak after the beep. "
                        + state.get("greeting", "How are you feeling today?")
                    )
                    action = f"/twilio/voice/recording?session_id={session_id}&phase=greeting&question_idx=0"
                else:
                    question_text = questions[question_idx] if question_idx < len(questions) else ""
                    retry_prompt = (
                        "I could not hear you clearly. Please speak after the beep. "
                        f"{question_text}"
                    )
                    action = (
                        f"/twilio/voice/recording?session_id={session_id}"
                        f"&phase=questions&question_idx={question_idx}"
                    )
                twiml = _build_record_twiml(retry_prompt, action)
                return Response(content=twiml, media_type="application/xml")

            if phase == "greeting":
                _append_session_transcript(session_id, f"GREETING_RESPONSE: {transcript}\n")
                state["greeting_notes"] = transcript

                if _asked_how_are_you(transcript):
                    ack = "I am doing great, thank you for asking."
                else:
                    ack = "Thank you for sharing that."

                if not questions:
                    closing = "Thank you for your time. Goodbye."
                    twiml = _build_hangup_twiml(f"{ack} {closing}")
                    _complete_session(session_id)
                    _twilio_calls.pop(session_id, None)
                    _twilio_calls.pop(CallSid, None)
                    return Response(content=twiml, media_type="application/xml")

                next_prompt = f"{ack} I have a few questions for you. {questions[0]}"
                action = f"/twilio/voice/recording?session_id={session_id}&phase=questions&question_idx=0"
                twiml = _build_record_twiml(next_prompt, action)
                return Response(content=twiml, media_type="application/xml")

            if question_idx >= len(questions):
                twiml = _build_hangup_twiml("Thank you for your time. Your responses have been recorded. Goodbye.")
                _complete_session(session_id)
                _twilio_calls.pop(session_id, None)
                _twilio_calls.pop(CallSid, None)
                return Response(content=twiml, media_type="application/xml")

            current_question = questions[question_idx]
            if _is_truthy(os.getenv("TWILIO_FAST_TURNS", "1")):
                classification = _quick_interruption_classifier(transcript)
            else:
                classification = _classify_with_gpt(current_question, transcript, "custom")

            if classification["type"] in {"interruption", "unexpected"}:
                followup = classification["short_followup"] or "Let us stay with this question."
                retry_prompt = f"{followup} {current_question}"
                action = (
                    f"/twilio/voice/recording?session_id={session_id}"
                    f"&phase=questions&question_idx={question_idx}"
                )
                twiml = _build_record_twiml(retry_prompt, action)
                return Response(content=twiml, media_type="application/xml")

            state.setdefault("answers", []).append(
                {"question": current_question, "answer": transcript}
            )
            state.setdefault("history", []).append(
                {
                    "question": current_question,
                    "transcript": transcript,
                    "classification": classification,
                }
            )
            _append_session_transcript(
                session_id,
                f"Q: {current_question}\nA: {transcript}\n",
            )

            next_idx = question_idx + 1
            if next_idx >= len(questions):
                closing = "Thank you for your time. Your responses have been recorded. Take care and goodbye."
                twiml = _build_hangup_twiml(closing)
                _complete_session(session_id)
                _twilio_calls.pop(session_id, None)
                _twilio_calls.pop(CallSid, None)
                return Response(content=twiml, media_type="application/xml")

            transition = _sentiment_transition(transcript)
            next_prompt = f"{transition} {questions[next_idx]}"
            action = (
                f"/twilio/voice/recording?session_id={session_id}"
                f"&phase=questions&question_idx={next_idx}"
            )
            twiml = _build_record_twiml(next_prompt, action)
            return Response(content=twiml, media_type="application/xml")

        state = _twilio_calls.get(CallSid)
        if not state:
            state = {
                "mode": "daily_checkin",
                "question_idx": 0,
                "answers": {},
                "history": [],
            }
            _twilio_calls[CallSid] = state

        mode = _normalize_mode(state.get("mode"))
        questions = _questions_for_mode(mode)
        idx = int(state.get("question_idx", 0))

        if idx >= len(questions):
            twiml = _build_hangup_twiml("Thank you. Goodbye.")
            _twilio_calls.pop(CallSid, None)
            return Response(content=twiml, media_type="application/xml")

        current_key, current_question = questions[idx]

        if not RecordingUrl:
            retry_prompt = f"I did not catch that. {current_question}"
            twiml = _build_record_twiml(retry_prompt, "/twilio/voice/recording")
            return Response(content=twiml, media_type="application/xml")

        try:
            transcript = _transcribe_twilio_recording(RecordingUrl)
        except Exception as exc:
            log.warning("Twilio recording transcription failed (call=%s): %s", CallSid, exc)
            transcript = ""

        log.info(
            "Twilio recording processed (call=%s, duration=%s, transcript=%s)",
            CallSid,
            RecordingDuration or "unknown",
            transcript or "<empty>",
        )

        if not transcript:
            retry_prompt = (
                "I could not hear you clearly. Please speak after the beep. "
                f"{current_question}"
            )
            twiml = _build_record_twiml(retry_prompt, "/twilio/voice/recording")
            return Response(content=twiml, media_type="application/xml")

        classification = _classify_with_gpt(current_question, transcript, mode)
        state["history"].append(
            {
                "question": current_question,
                "transcript": transcript,
                "classification": classification,
            }
        )

        if classification["type"] in {"interruption", "unexpected"}:
            followup = classification["short_followup"] or "Let us stay with this question."
            retry_prompt = f"{followup} {current_question}"
            twiml = _build_record_twiml(retry_prompt, "/twilio/voice/recording")
            return Response(content=twiml, media_type="application/xml")

        state["answers"][current_key] = transcript
        state["question_idx"] = idx + 1

        if state["question_idx"] >= len(questions):
            combined_transcript = " ".join(str(v) for v in state["answers"].values())
            try:
                llm_result = ask_watsonx(
                    combined_transcript,
                    {
                        "text_heuristic_flags": [],
                        "source": "twilio_call",
                        "turn_count": len(state["history"]),
                    },
                )
                closing = llm_result.get("tts_reply", "").strip()
            except Exception:
                closing = ""

            if not closing:
                closing = "Thank you. I have shared your answers with your care team. Goodbye."

            twiml = _build_hangup_twiml(closing)
            _twilio_calls.pop(CallSid, None)
            return Response(content=twiml, media_type="application/xml")

        next_question = questions[state["question_idx"]][1]
        next_prompt = f"Thanks. {next_question}"
        twiml = _build_record_twiml(next_prompt, "/twilio/voice/recording")
        return Response(content=twiml, media_type="application/xml")

    except Exception:
        twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Response><Say voice="alice">'
            'We had a temporary issue. Please expect a callback shortly.'
            "</Say><Hangup/></Response>"
        )
        return Response(content=twiml, media_type="application/xml")


@app.post("/twilio/status")
async def twilio_status(
    CallSid: str = Form(default=""),
    CallStatus: str = Form(default=""),
    session_id: str | None = None,
):
    if session_id:
        _complete_session(session_id, call_status=CallStatus or "completed")
        _twilio_calls.pop(session_id, None)

    if CallSid:
        call_state = _twilio_calls.pop(CallSid, None)
        if call_state and call_state.get("session_id"):
            _complete_session(call_state["session_id"], call_status=CallStatus or "completed")
            _twilio_calls.pop(call_state["session_id"], None)

    return Response(content="OK", media_type="text/plain")


@app.get("/twilio/call/{call_sid}/state")
async def twilio_call_state(call_sid: str):
    """Debug endpoint so frontend can inspect in-memory call progress."""
    state = _twilio_calls.get(call_sid)
    if not state:
        raise HTTPException(status_code=404, detail="Call state not found")
    return state
