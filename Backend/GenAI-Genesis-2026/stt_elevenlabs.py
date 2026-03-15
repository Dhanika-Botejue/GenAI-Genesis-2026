#STT


import httpx
from pathlib import Path
from config import settings


class ElevenLabsSTTError(Exception):
    pass


async def transcribe_audio(file_path: str) -> dict:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    url = "https://api.elevenlabs.io/v1/speech-to-text"

    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
    }

    with open(path, "rb") as audio_file:
        files = {
            "file": (path.name, audio_file, "audio/wav"),
        }

        data = {
            "model_id": settings.elevenlabs_stt_model_id,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                headers=headers,
                files=files,
                data=data,
            )

    if response.status_code >= 400:
        raise ElevenLabsSTTError(
            f"ElevenLabs STT failed: {response.status_code} {response.text}"
        )

    return response.json()


def extract_transcript(stt_response: dict) -> str:
    return (
        stt_response.get("text")
        or stt_response.get("transcript")
        or ""
    ).strip()