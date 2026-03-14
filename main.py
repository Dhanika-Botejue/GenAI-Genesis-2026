import os
import tempfile
import threading
import queue

from fastapi import FastAPI, UploadFile, File, HTTPException
from contextlib import asynccontextmanager

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
    MIC_SAMPLE_RATE,
    MIC_CHANNELS,
    END_OF_PHRASE_SILENCE,
)

from dotenv import load_dotenv
import pyaudio
from ibm_watson.websocket import AudioSource

load_dotenv()

# ── IBM Watson clients ────────────────────────────────────────────────────────

def build_stt_client() -> SpeechToTextV1:
    auth = IAMAuthenticator(os.getenv("STT_API_KEY"))
    stt  = SpeechToTextV1(authenticator=auth)
    stt.set_service_url(os.getenv("STT_URL"))
    return stt

def build_tts_client() -> TextToSpeechV1:
    auth = IAMAuthenticator(os.getenv("TTS_API_KEY"))
    tts  = TextToSpeechV1(authenticator=auth)
    tts.set_service_url(os.getenv("TTS_URL"))
    return tts


# ── Voice chatbot state (runs in background threads) ─────────────────────────

_voice_state: dict = {}


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
    start_voice_chatbot()
    yield
    stop_voice_chatbot()


app = FastAPI(lifespan=lifespan)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "AI NLP service is running"}


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