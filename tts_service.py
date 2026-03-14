import os
import requests
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Create audio dir if it doesn't exist
os.makedirs("audio", exist_ok=True)

def generate_tts(text, filename="output.mp3"):
    """Generates TTS using ElevenLabs API and saves to audio/ directory."""
    filepath = os.path.join("audio", filename)
    
    # Simple caching to avoid regenerating the exact same audio unnecessarily during demo
    if os.path.exists(filepath):
        print(f"Using cached audio for {filename}")
        return filename
        
    url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL" # Rachel voice
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        return filename
    else:
        print("ElevenLabs API Error:", response.text)
        raise Exception("TTS Generation Failed")
