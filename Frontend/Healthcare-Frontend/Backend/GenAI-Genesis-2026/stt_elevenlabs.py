"""
ElevenLabs Speech-to-Text. Replaces IBM Watson STT.
"""
import os
import tempfile
import httpx

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY") or os.getenv("XI_API_KEY")
ELEVENLABS_STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1")


class ElevenLabsSTTError(Exception):
    pass


def transcribe_audio_sync(audio_bytes: bytes, content_type: str = "audio/wav") -> str:
    """
    Transcribe audio bytes using ElevenLabs STT (synchronous).
    Returns transcript text.
    """
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY or XI_API_KEY is required")

    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": ELEVENLABS_API_KEY}

    # Determine file extension from content_type
    ext = ".wav" if "wav" in content_type else ".mp3"
    suffix = ext if ext.startswith(".") else f".{ext}"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            files = {"file": (f"audio{suffix}", audio_file, content_type)}
            data = {"model_id": ELEVENLABS_STT_MODEL}

            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, headers=headers, files=files, data=data)

        if response.status_code >= 400:
            raise ElevenLabsSTTError(
                f"ElevenLabs STT failed: {response.status_code} {response.text}"
            )

        result = response.json()
        return (result.get("text") or result.get("transcript") or "").strip()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def transcribe_file_sync(file_path: str) -> str:
    """Transcribe an audio file. Convenience wrapper."""
    with open(file_path, "rb") as f:
        content = f.read()
    return transcribe_audio_sync(content, "audio/wav")
