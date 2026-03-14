#main pipeline 
import os
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException

from stt_elevenlabs import transcribe_audio, extract_transcript
from audio_features import extract_acoustic_features

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "AI NLP service is running"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    temp_path = None

    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        stt_response = await transcribe_audio(temp_path)
        transcript = extract_transcript(stt_response)
        acoustic_features = extract_acoustic_features(temp_path)

        return {
            "filename": file.filename,
            "transcript": transcript,
            "acoustic_features": acoustic_features,
            "raw_response": stt_response
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)