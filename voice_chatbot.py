import os
import sys
import ctypes
import datetime
import json
import math
import pathlib
import struct
import subprocess
import time
import threading
import queue
import logging
import urllib.request

import pyaudio
from dotenv import load_dotenv

from ibm_watson import SpeechToTextV1, TextToSpeechV1
from ibm_watson.websocket import RecognizeCallback, AudioSource
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator


logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# Must be module-level — if this were a local variable, Python's GC would free
# it after the function returns, leaving ALSA with a dangling pointer and
# causing a segfault on the next ALSA call.
_ALSA_ERROR_HANDLER_T = ctypes.CFUNCTYPE(
    None,
    ctypes.c_char_p, ctypes.c_int,
    ctypes.c_char_p, ctypes.c_int,
    ctypes.c_char_p,
)
_ALSA_NOOP = _ALSA_ERROR_HANDLER_T(lambda *_: None)

def _suppress_alsa_errors() -> None:
    try:
        ctypes.cdll.LoadLibrary("libasound.so.2").snd_lib_error_set_handler(_ALSA_NOOP)
    except OSError:
        pass

_suppress_alsa_errors()


load_dotenv()

STT_API_KEY        = os.getenv("STT_API_KEY")
STT_URL            = os.getenv("STT_URL")
TTS_API_KEY        = os.getenv("TTS_API_KEY")
TTS_URL            = os.getenv("TTS_URL")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not all([STT_API_KEY, STT_URL, TTS_API_KEY, TTS_URL]):
    log.error(
        "One or more IBM Watson credentials are missing from the .env file.\n"
        "Required keys: STT_API_KEY, STT_URL, TTS_API_KEY, TTS_URL"
    )
    sys.exit(1)

if not OPENROUTER_API_KEY:
    log.warning(
        "OPENROUTER_API_KEY not set — AI summaries will be skipped.\n"
        "Add it to your .env file to enable end-of-session summaries."
    )

STT_MODEL             = "en-US_Multimedia"
END_OF_PHRASE_SILENCE = 2.0

TTS_VOICE        = "en-US_AllisonExpressive"
TTS_AUDIO_FORMAT = "audio/wav"

MIC_CHUNK_SIZE  = 1024
MIC_FORMAT      = pyaudio.paInt16
MIC_CHANNELS    = 2
MIC_SAMPLE_RATE = 16_000
MIC_DEVICE_INDEX = 5


def build_stt_client() -> SpeechToTextV1:
    auth = IAMAuthenticator(STT_API_KEY)
    stt  = SpeechToTextV1(authenticator=auth)
    stt.set_service_url(STT_URL)
    return stt


def build_tts_client() -> TextToSpeechV1:
    auth = IAMAuthenticator(TTS_API_KEY)
    tts  = TextToSpeechV1(authenticator=auth)
    tts.set_service_url(TTS_URL)
    return tts


CARE_NOTES_DIR = pathlib.Path("care_notes")
CARE_NOTES_DIR.mkdir(exist_ok=True)


def save_care_note(
    session_type: str,
    answers: dict,
    speech_flags: list,
    ai_summary: str = "",
) -> pathlib.Path:
    timestamp = datetime.datetime.now()
    filename  = CARE_NOTES_DIR / f"{session_type}_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"
    payload   = {
        "session_type": session_type,
        "timestamp":    timestamp.isoformat(),
        "answers":      answers,
        "speech_flags": speech_flags,
        "ai_summary":   ai_summary,
    }
    with open(filename, "w") as fh:
        json.dump(payload, fh, indent=2)
    log.info("Care note saved → %s", filename)
    return filename


def generate_ai_summary(session_type: str, answers: dict, speech_flags: list) -> str:
    if not OPENROUTER_API_KEY:
        return ""

    session_label = session_type.replace("_", " ").title()
    qa_lines      = "\n".join(
        f"  {k.replace('_', ' ').title()}: {v}" for k, v in answers.items()
    )
    flags_text = (
        "\n".join(f"  • {f}" for f in speech_flags) if speech_flags else "  None"
    )

    prompt = (
        f"You are a clinical documentation assistant in a nursing home.\n"
        f"Summarise the following {session_label} in 3-5 clear sentences "
        f"suitable for a nurse's handover note. Highlight any concerns.\n\n"
        f"Patient responses:\n{qa_lines}\n\n"
        f"Speech analysis flags:\n{flags_text}\n\n"
        f"Write the summary now:"
    )

    payload = json.dumps({
        "model":    "stepfun/step-3.5-flash:free",
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type":  "application/json",
            "HTTP-Referer":  "https://github.com/senior-care-voice-bot",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body    = json.loads(resp.read().decode())
            summary = body["choices"][0]["message"]["content"].strip()
            log.info("\n╔══ AI SUMMARY ══╗\n%s\n╚%s╝", summary, "═" * 30)
            return summary
    except Exception as exc:
        log.warning("AI summary failed: %s", exc)
        return ""


class NurseCheckIn:
    """
    Stateful conversation manager for nurse-style health check-ins.

    Supports two modes:
      • daily_checkin    — routine daily wellness questions for the resident
      • physician_intake — structured pre-visit summary for the doctor
    """

    DAILY_QUESTIONS: list[tuple[str, str]] = [
        (
            "general_feeling",
            "How are you feeling today?",
        ),
        (
            "pain",
            "Are you having any pain? If so, please tell me where and how bad "
            "it is on a scale of 1 to 10.",
        ),
        (
            "sleep",
            "Did you sleep well last night?",
        ),
        (
            "dizziness_weakness_breathing",
            "Are you feeling dizzy, weak, or short of breath at all?",
        ),
        (
            "eating_drinking",
            "Have you had any trouble eating or drinking today?",
        ),
    ]

    PHYSICIAN_QUESTIONS: list[tuple[str, str]] = [
        (
            "symptoms",
            "Let's gather some information before your doctor visits. "
            "What symptoms are you currently experiencing?",
        ),
        (
            "pain",
            "Are you having any pain? If so, where is it and how would you "
            "rate it from 1 to 10?",
        ),
        (
            "medication_concerns",
            "Do you have any concerns or questions about your medications?",
        ),
        (
            "appetite",
            "How has your appetite been lately?",
        ),
        (
            "sleep",
            "How has your sleep been? Are you sleeping through the night?",
        ),
        (
            "bowel_bladder",
            "Have you had any changes in your bowel or bladder habits?",
        ),
        (
            "mood",
            "How has your mood been? Have you been feeling sad, anxious, "
            "or confused at all?",
        ),
        (
            "mobility",
            "Have you noticed any changes in your ability to move around or walk?",
        ),
    ]

    _URGENT_PHRASES = [
        "chest pain", "chest hurts", "heart", "can't breathe", "cannot breathe",
        "hard to breathe", "difficulty breathing", "stopped breathing",
        "fell down", "i fell", "on the floor", "can't get up", "cannot get up",
        "very bad pain", "excruciating",
    ]

    _WAKE_WORDS = ["helper", "hey helper", "hello helper", "hi helper"]

    def __init__(self) -> None:
        self._mode         = "idle"
        self._question_idx = 0
        self._answers:      dict = {}
        self._speech_flags: list = []

    def process(self, user_text: str) -> str:
        if self._mode == "idle":
            return self._handle_idle(user_text)

        self._analyse_speech(user_text)
        questions    = self._current_questions()
        key, _       = questions[self._question_idx]
        self._answers[key] = user_text
        self._question_idx += 1

        urgent_prefix = self._check_urgent(user_text)

        if self._question_idx < len(questions):
            _, next_q = questions[self._question_idx]
            bridge    = "Thank you." if not urgent_prefix else urgent_prefix
            return f"{bridge} {next_q}"

        return self._finish_session(urgent_prefix)

    def _handle_idle(self, text: str) -> str:
        t = text.lower()

        if any(ww in t for ww in self._WAKE_WORDS):
            log.info("Wake word detected: %s", text)
            return (
                "Hello! I'm Helper, your care assistant. "
                "I can do a daily health check-in, or gather notes before "
                "your doctor visits. "
                "Just say 'daily check-in' or 'doctor visit' whenever you're ready."
            )

        if any(kw in t for kw in ["daily check", "check in", "checkin", "health check",
                                   "how am i", "morning check", "routine check"]):
            return self._start("daily_checkin")

        if any(kw in t for kw in ["doctor", "physician", "pre-visit", "before my visit",
                                   "doctor visit", "pre visit"]):
            return self._start("physician_intake")

        if any(kw in t for kw in ["hello", "hi", "hey", "good morning", "good afternoon",
                                   "good evening"]):
            return (
                "Hello! I'm your care assistant. "
                "I can do a daily health check-in, or gather information before "
                "your doctor visits. "
                "Just say 'daily check-in' or 'doctor visit' whenever you're ready."
            )

        if any(kw in t for kw in ["help", "what can you do", "what do you do"]):
            return (
                "I can help with two things. "
                "First, I can ask you a few daily health questions and pass your "
                "answers to your care team. "
                "Second, before a doctor visit I can take a detailed note so the "
                "doctor is prepared when they arrive. "
                "Say 'daily check-in' or 'doctor visit' to begin."
            )

        if any(kw in t for kw in ["bye", "goodbye", "see you", "good night"]):
            return "Goodbye! Take care and have a wonderful day. I'm here whenever you need me."

        return (
            "I'm here to help with your health check-in. "
            "You can say 'daily check-in' to answer a few wellness questions, "
            "or 'doctor visit' to prepare notes for your physician."
        )

    def _start(self, mode: str) -> str:
        self._mode         = mode
        self._question_idx = 0
        self._answers      = {}
        self._speech_flags = []
        _, first_q = self._current_questions()[0]
        if mode == "daily_checkin":
            intro = (
                "Great, let's do your daily health check-in. "
                "I'll ask you a few short questions. Take your time answering. "
            )
        else:
            intro = (
                "Of course. I'll gather some information before your doctor visits. "
                "Please take your time with each answer. "
            )
        return intro + first_q

    def _current_questions(self) -> list:
        return (
            self.DAILY_QUESTIONS
            if self._mode == "daily_checkin"
            else self.PHYSICIAN_QUESTIONS
        )

    def _check_urgent(self, text: str) -> str:
        if any(phrase in text.lower() for phrase in self._URGENT_PHRASES):
            log.warning("URGENT keyword detected in resident speech: %s", text)
            return "That sounds like it may need immediate attention. I'm alerting your nurse right away."
        return ""

    def _analyse_speech(self, text: str) -> None:
        """
        Lightweight heuristics to flag potential neurological indicators.
        These act as a first-pass safety net until a proper NLP/ML model is integrated.
        """
        words = text.lower().split()
        if not words:
            return

        counts: dict = {}
        for w in words:
            if len(w) > 3:
                counts[w] = counts.get(w, 0) + 1
        repeated = [w for w, c in counts.items() if c > 2]
        if repeated:
            self._speech_flags.append(
                f"Possible word perseveration — repeated: {', '.join(repeated)}"
            )

        unique_ratio = len(set(words)) / len(words)
        if len(words) >= 6 and unique_ratio < 0.45:
            self._speech_flags.append(
                f"Low vocabulary diversity ({unique_ratio:.2f}) — possible confusion or aphasia"
            )

        if len(words) <= 1:
            self._speech_flags.append("Single-word or empty response — possible withdrawal")

    def _finish_session(self, urgent_prefix: str) -> str:
        mode         = self._mode
        answers      = dict(self._answers)
        speech_flags = list(self._speech_flags)

        self._mode = "idle"

        ai_summary = generate_ai_summary(mode, answers, speech_flags)
        save_care_note(mode, answers, speech_flags, ai_summary)

        lines = [f"  {k.replace('_', ' ').title()}: {v}" for k, v in answers.items()]
        log.info(
            "\n╔══ CARE NOTE (%s) ══╗\n%s\n╚%s╝",
            mode.upper().replace("_", " "),
            "\n".join(lines),
            "═" * 30,
        )
        if speech_flags:
            log.warning("Speech analysis flags:\n  • %s", "\n  • ".join(speech_flags))

        summary = (
            "Thank you so much for answering all those questions. "
            "I've recorded your responses and shared them with your care team."
        )
        if mode == "physician_intake":
            summary += (
                " Your doctor will receive a full summary before the visit so "
                "they can be well prepared for you."
            )
        if speech_flags:
            summary += (
                " I also noticed a few things about how you were speaking and "
                "have flagged them for your nurse to take a look at."
            )
        if urgent_prefix:
            summary = urgent_prefix + " " + summary

        summary += " Is there anything else I can help you with?"
        return summary


_nurse_session = NurseCheckIn()


def generate_bot_response(user_text: str) -> str:
    return _nurse_session.process(user_text)


def wrap_in_ssml(text: str) -> str:
    safe_text = (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xml:lang="en-US">'
        '<prosody rate="-10%">'
        f"{safe_text}"
        "</prosody>"
        "</speak>"
    )


def speak(tts_client: TextToSpeechV1, text: str, tts_active: threading.Event) -> None:
    """
    Synthesise text with Watson TTS and pipe the WAV bytes into aplay.

    tts_active is held for the entire duration so that MicrophoneStream.read()
    returns silence, preventing the bot from transcribing its own voice.
    """
    if not text or not text.strip():
        return

    log.info("Speaking: %s", text)
    tts_active.set()
    try:
        response = tts_client.synthesize(
            text=wrap_in_ssml(text),
            accept=TTS_AUDIO_FORMAT,
            voice=TTS_VOICE,
        ).get_result()

        proc = subprocess.Popen(
            ["aplay", "-q", "-"],
            stdin=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        proc.communicate(input=response.content)

        time.sleep(0.3)

    except FileNotFoundError:
        log.error("'aplay' not found. Install it with:  sudo apt-get install alsa-utils")
    except Exception as exc:
        log.error("TTS playback error: %s", exc)
    finally:
        tts_active.clear()


class SeniorCareCallback(RecognizeCallback):
    """
    Watson STT WebSocket event handler.

    on_data() is used instead of on_transcription() because the 'final' flag
    lives one level above 'alternatives' in the JSON — on_transcription() only
    receives the alternatives sub-list and never sees it.
    """

    def __init__(self, response_queue: queue.Queue) -> None:
        super().__init__()
        self.response_queue = response_queue

    def on_data(self, data: dict) -> None:
        for result in data.get("results", []):
            alternatives = result.get("alternatives", [])
            if not alternatives:
                continue

            best       = alternatives[0]
            text       = best.get("transcript", "").strip()
            is_final   = result.get("final", False)
            confidence = best.get("confidence", 1.0) or 1.0

            if not text:
                continue

            if is_final:
                print()
                if confidence < 0.55:
                    log.info("Ignored low-confidence transcript (%.2f): %s", confidence, text)
                    continue
                if len(text.split()) < 1:
                    log.info("Ignored empty transcript (conf=%.2f): %s", confidence, text)
                    continue
                log.info("FINAL   ▶ %s  (confidence=%.2f)", text, confidence)
                self.response_queue.put(text)
            else:
                print(f"\r  Hearing: {text:<80}", end="", flush=True)

    def on_connected(self)                        -> None: log.info("STT WebSocket connected — listening …")
    def on_close(self)                            -> None: log.info("STT WebSocket closed.")
    def on_listening(self)                        -> None: log.info("Watson STT is ready and listening.")
    def on_transcription(self, transcript: list)  -> None: pass
    def on_hypothesis(self, hypothesis: str)      -> None: pass
    def on_error(self, error: Exception)          -> None: log.error("STT WebSocket error: %s", error)
    def on_inactivity_timeout(self, error: str)   -> None: log.warning("STT inactivity timeout: %s", error)


def list_input_devices(pa: pyaudio.PyAudio) -> None:
    log.info("Available input devices:")
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        if info["maxInputChannels"] > 0:
            log.info(
                "  [%d] %s  (max %d ch, default rate: %.0f Hz)",
                i, info["name"], info["maxInputChannels"], info["defaultSampleRate"],
            )


def check_mic_level(mic: "MicrophoneStream") -> None:
    log.info("Testing mic level for 1 second — make some noise …")
    try:
        n_chunks = int(MIC_SAMPLE_RATE / MIC_CHUNK_SIZE)
        raw      = b"".join(mic.read(MIC_CHUNK_SIZE) for _ in range(n_chunks))
        count    = len(raw) // 2
        shorts   = struct.unpack(f"{count}h", raw)
        rms      = math.sqrt(sum(s * s for s in shorts) / count) if count else 0.0

        if rms < 50:
            log.warning(
                "Mic RMS=%.1f — level is VERY LOW (silence?). "
                "The mic may be muted or the wrong device was chosen.\n"
                "  Fix options:\n"
                "    1. Open 'pavucontrol' or 'alsamixer' and unmute/raise the mic.\n"
                "    2. Set MIC_DEVICE_INDEX at the top of this file to a different\n"
                "       device number from the list above.",
                rms,
            )
        else:
            log.info("Mic level OK  (RMS=%.1f)", rms)

    except Exception as exc:
        log.warning("Mic level check failed: %s", exc)


class MicrophoneStream:
    """
    File-like wrapper around a PyAudio input stream.

    The Watson SDK calls self.audio_source.input.read(n), so this class
    exposes a .read(size) method rather than the iterator protocol.

    While tts_active is set, .read() drains the hardware buffer but returns
    silence so Watson never transcribes the bot's own voice.
    """

    def __init__(self, pa: pyaudio.PyAudio, tts_active: threading.Event) -> None:
        self._tts_active = tts_active

        if MIC_DEVICE_INDEX is not None:
            self.device_index = MIC_DEVICE_INDEX
            log.info("Microphone: using override device index %d", self.device_index)
        else:
            try:
                info = pa.get_default_input_device_info()
                self.device_index = int(info["index"])
                log.info("Microphone: %s (device %d)", info["name"], self.device_index)
            except OSError:
                self.device_index = None
                log.warning("Could not query default input device — using PyAudio default")

        try:
            self._stream = pa.open(
                format=MIC_FORMAT,
                channels=MIC_CHANNELS,
                rate=MIC_SAMPLE_RATE,
                input=True,
                input_device_index=self.device_index,
                frames_per_buffer=MIC_CHUNK_SIZE,
            )
        except OSError as exc:
            log.error(
                "Cannot open microphone: %s\n"
                "Check that a microphone is connected and not in use by another app.",
                exc,
            )
            raise

        self._closed = False

    def read(self, size: int) -> bytes:
        if self._closed:
            return b""
        try:
            raw = self._stream.read(size, exception_on_overflow=False)
            return b"\x00" * len(raw) if self._tts_active.is_set() else raw
        except OSError as exc:
            log.error("Microphone read error: %s", exc)
            return b""

    def close(self) -> None:
        self._closed = True
        self._stream.stop_stream()
        self._stream.close()


def response_worker(
    response_queue: queue.Queue,
    tts_client: TextToSpeechV1,
    tts_active: threading.Event,
    stop_event: threading.Event,
) -> None:
    while not stop_event.is_set():
        try:
            user_text = response_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        log.info("User said: %s", user_text)
        bot_reply = generate_bot_response(user_text)
        log.info("Bot reply: %s", bot_reply)
        speak(tts_client, bot_reply, tts_active)
        response_queue.task_done()


def main() -> None:
    log.info("Starting Senior Care Voice Chatbot …")

    try:
        stt_client = build_stt_client()
        tts_client = build_tts_client()
        log.info("IBM Watson clients authenticated successfully.")
    except Exception as exc:
        log.error("Failed to authenticate IBM Watson clients: %s", exc)
        sys.exit(1)

    # Speaker output goes through aplay (subprocess) rather than a PyAudio output
    # stream to avoid ALSA conflicts between simultaneous input/output streams.
    # Suppress JACK "cannot connect to server" spam by briefly redirecting stderr
    # at the file-descriptor level (the ALSA ctypes handler above only silences ALSA).
    _devnull      = os.open(os.devnull, os.O_WRONLY)
    _saved_stderr = os.dup(2)
    os.dup2(_devnull, 2)
    pa = pyaudio.PyAudio()
    os.dup2(_saved_stderr, 2)
    os.close(_devnull)
    os.close(_saved_stderr)

    response_queue: queue.Queue = queue.Queue()
    stop_event  = threading.Event()
    tts_active  = threading.Event()

    list_input_devices(pa)

    try:
        mic = MicrophoneStream(pa, tts_active)
    except OSError:
        stop_event.set()
        pa.terminate()
        sys.exit(1)

    worker = threading.Thread(
        target=response_worker,
        args=(response_queue, tts_client, tts_active, stop_event),
        daemon=True,
        name="ResponseWorker",
    )
    worker.start()

    check_mic_level(mic)

    speak(
        tts_client,
        "Hello! I'm your care assistant. "
        "I can do a daily health check-in, or gather information before "
        "your doctor visits. "
        "Just say 'daily check-in' or 'doctor visit' whenever you're ready.",
        tts_active,
    )

    log.info("Press Ctrl+C to stop.")

    # Watson STT sessions time out after ~30 s of inactivity; this loop
    # reconnects automatically so the bot stays alive indefinitely.
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
        except KeyboardInterrupt:
            log.info("Shutting down — goodbye!")
            break
        except Exception as exc:
            log.error("STT session error: %s", exc)

        if not stop_event.is_set():
            log.info("Reconnecting STT in 1 second …")
            stop_event.wait(timeout=1.0)

    audio_source.is_recording = False
    mic.close()
    stop_event.set()
    worker.join(timeout=5)
    pa.terminate()
    log.info("Chatbot stopped cleanly.")


if __name__ == "__main__":
    main()