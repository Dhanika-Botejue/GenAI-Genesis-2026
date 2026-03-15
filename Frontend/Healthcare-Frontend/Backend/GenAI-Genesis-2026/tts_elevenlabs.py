"""
ElevenLabs Text-to-Speech. Replaces IBM Watson TTS.
"""
import os
import httpx

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY") or os.getenv("XI_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_monolingual_v1")


def synthesize(text: str, output_format: str = "mp3_44100_128") -> bytes:
    """
    Synthesize text to speech using ElevenLabs.
    Returns raw audio bytes. output_format: mp3_44100_128, wav_44100, etc.
    """
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY or XI_API_KEY is required")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    params = {"output_format": output_format}
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, params=params, headers=headers, json=payload)
        response.raise_for_status()
        return response.content
