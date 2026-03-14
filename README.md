# GenAI-Genesis-2026 — Senior Care Voice Assistant

An AI-powered voice assistant for nursing homes that reduces nurse workload through automated health check-ins, speech analysis, LLM-generated care notes, and real-time fall detection.

---

## Features

- **Voice check-ins** — daily wellness questions or pre-physician intake, triggered by wake word or keyword
- **Speech analysis** — opensmile acoustic feature extraction (eGeMAPSv02) to detect low loudness, voice instability, fragmented speech, and long pauses
- **LLM care notes** — IBM WatsonX generates structured care notes with urgency level, normalised symptoms, and a TTS reply after each session
- **Fall detection** — MediaPipe Pose monitors a camera feed in the background; fires nurse alerts at Urgent / Mid / Low severity
- **Nurse alerts** — printed to console (ready to be forwarded to a dashboard) with timestamp, urgency level, and source (camera or speech)
- **Care note storage** — each session saved as a timestamped JSON in `care_notes/`

---

## Setup

### 1. System dependencies (Linux)

```bash
sudo apt install portaudio19-dev python3-dev
```

### 2. Virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Environment variables

```bash
cp .env.example .env
# Fill in your credentials in .env
```

| Variable | Required | Description |
|---|---|---|
| `STT_API_KEY` | Yes | IBM Watson Speech-to-Text API key |
| `STT_URL` | Yes | IBM Watson STT service URL |
| `TTS_API_KEY` | Yes | IBM Watson Text-to-Speech API key |
| `TTS_URL` | Yes | IBM Watson TTS service URL |
| `IBM_WATSONX_API_KEY` | Yes | IBM WatsonX API key |
| `IBM_WATSONX_URL` | Yes | WatsonX endpoint (default: `https://us-south.ml.cloud.ibm.com`) |
| `IBM_WATSONX_PROJECT_ID` | Yes | WatsonX project ID |
| `IBM_WATSONX_MODEL_ID` | No | Model ID (default: `ibm/granite-13b-instruct-v2`) |
| `OPENROUTER_API_KEY` | No | Fallback care note summary if WatsonX is unavailable |

---

## Running

```bash
source venv/bin/activate
python voice_chatbot.py
```

Press `Ctrl+C` to stop.

### First run — set your microphone index

On startup the bot logs all available input devices. If the mic is not detected on device `1`, update `MIC_DEVICE_INDEX` near the top of `voice_chatbot.py`.

---

## How it works

```
Resident speaks
      │
      ▼
IBM Watson STT ──► NurseCheckIn (conversation manager)
                        │  collects answers per question
                        │  text heuristics flag perseveration / aphasia
                        │
                   Session ends
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
    AudioBuffer → opensmile    WatsonX LLM
    acoustic features          (llm_reasoning.py)
    (speech_analysis.py)            │
             │                      │
             └──────────┬───────────┘
                        ▼
                  care_notes/*.json
                  nurse_alert() if urgency detected
                  IBM Watson TTS speaks reply

Camera feed (background thread)
      │
      ▼
MediaPipe Pose ──► fall_detection.py ──► nurse_alert()
                                              │
                                        Urgent fall → TTS "help is on the way"
```

---

## File overview

| File | Purpose |
|---|---|
| `voice_chatbot.py` | Main entry point — STT, TTS, conversation loop, care note pipeline |
| `fall_detection.py` | Background camera-based fall detection (MediaPipe Pose) |
| `speech_analysis.py` | Derives acoustic flags from opensmile features |
| `audio_features.py` | Extracts eGeMAPSv02 features from a WAV file via opensmile |
| `llm_reasoning.py` | Calls IBM WatsonX to produce structured care note JSON |
| `config.py` | Pydantic settings loaded from `.env` |
| `care_notes/` | Timestamped JSON care notes saved after each session |
