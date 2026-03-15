# GenAI-Genesis-2026 Backend

Backend services for a senior-care voice assistant platform.

This backend supports two operating modes:

1. Local microphone chatbot (`voice_chatbot.py`) for in-room/offline style interaction.
2. HTTP API server (`main.py`) for frontend-driven patient workflows and Twilio phone calls.

The frontend is expected to live in a separate repository/directory and communicate with this backend over HTTP.

## What This Backend Does

- Conducts structured resident check-ins (daily, physician intake, post-fall).
- Transcribes speech with IBM Watson STT.
- Generates spoken prompts with IBM Watson TTS.
- Performs acoustic feature analysis with OpenSMILE.
- Uses WatsonX (and optional OpenAI classification for phone turns) for reasoning/care summaries.
- Detects falls from camera feed (MediaPipe Pose).
- Stores resident/session data in MongoDB (or memory fallback in some paths).
- Orchestrates outbound Twilio calls and webhook-driven call state machines.

## High-Level Architecture

```text
 +---------------------------+
 | Frontend (separate repo) |
 +-------------+-------------+
                                           |
                                           | REST
                                           v
 +---------------------------+
 | FastAPI (main.py)         |
 | - /api/patients           |
 | - /api/call               |
 | - /twilio/* webhooks      |
 +-------------+-------------+
                                           |
       +-----------+-----------+
       |                       |
       v                       v
 +----------------------+  +----------------------+
 | MongoDB (db.py)      |  | Twilio Voice         |
 | residents/sessions   |  | outbound + callbacks |
 +----------------------+  +----------+-----------+
                                                                                                             |
                                                                                                             v
                                                      +-----------------------------------+
                                                      | IBM STT/TTS + WatsonX/OpenAI      |
                                                      +-----------------------------------+

Local mode (voice_chatbot.py) runs independently from FastAPI and directly
handles mic input, STT, TTS, analysis, fall detection, and care note JSON output.
```

## Repository Layout And Purpose

| Path | Purpose |
|---|---|
| `main.py` | FastAPI backend: patient APIs, call initiation, Twilio webhooks, local voice lifecycle hooks. |
| `voice_chatbot.py` | Standalone real-time microphone chatbot with session manager and care note generation. |
| `db.py` | MongoDB connection/seeding plus demo facility/resident/session data bootstrap. |
| `llm_reasoning.py` | WatsonX prompt construction and strict JSON response parsing. |
| `audio_features.py` | OpenSMILE feature extraction from WAV file. |
| `speech_analysis.py` | Acoustic summaries + rule-based speech flag derivation. |
| `fall_detection.py` | MediaPipe Pose based camera fall detection thread and alert callback integration. |
| `config.py` | Pydantic settings model for Watson credentials/config. |
| `stt_elevenlabs.py` | Alternate experimental STT helper (not integrated into main flow). |
| `test_mic.py` | Utility to find a valid `MIC_DEVICE_INDEX` by RMS signal level. |
| `test_llm.py` | Local sanity script to invoke `ask_watsonx` with sample input. |
| `care_notes/` | Output JSON files produced by local voice sessions. |
| `twilio_audio/` | Cached/generated WAV prompts served to Twilio via `/twilio/audio/*`. |
| `pose_landmarker.task` | MediaPipe model file for fall detection. |

## Core Runtime Flows

### 1) Local Voice Chatbot (`voice_chatbot.py`)

1. Loads env credentials and initializes IBM STT/TTS clients.
2. Opens microphone stream, measures mic RMS, and starts response worker thread.
3. Streams mic audio to Watson STT websocket.
4. `NurseCheckIn` state machine handles:
   - Mode selection (`daily_checkin`, `physician_intake`, `fall_checkin`)
   - Question progression
   - Urgency phrase detection and nurse alerts
5. On session completion:
   - Audio buffer is analyzed with OpenSMILE (`audio_features.py`).
   - Acoustic flags are computed (`speech_analysis.py`).
   - WatsonX generates structured reasoning (`llm_reasoning.py`).
   - Care note JSON is saved to `care_notes/`.
   - TTS plays final response.
6. Optional camera fall detector runs in parallel and can trigger fall check-ins.

### 2) API Server (`main.py`)

1. FastAPI starts with lifespan hook.
2. If DB is available, `db.init_db()` seeds demo data when empty.
3. If `ENABLE_LOCAL_VOICE_CHATBOT=1`, local voice chatbot is started in background.
4. Frontend consumes patient/call APIs.
5. Twilio webhooks drive call state transitions via `/twilio/voice/answer` and `/twilio/voice/recording`.
6. Transcript + session state persist in MongoDB (or memory fallback depending on DB mode).

## API Surface (Frontend-Relevant)

### Patient and Session APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Health message. |
| `GET` | `/api/patients` | List residents. |
| `POST` | `/api/patients` | Create resident (`firstName`, `lastName`, `phone`). |
| `GET` | `/api/patients/{patient_id}` | Fetch one resident. |
| `PATCH` | `/api/patients/{patient_id}` | Update resident fields. |
| `DELETE` | `/api/patients/{patient_id}` | Delete resident and associated session data. |
| `GET` | `/api/patients/{patient_id}/history` | Session history for resident. |
| `GET` | `/api/sessions/{session_id}` | Poll one outbound call session for live Doctor mode updates. |
| `POST` | `/api/call` | Create outbound structured call for a patient with custom question list. |

### Voice Utility APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/transcribe` | Upload audio file for transcript + analysis + LLM result. |
| `GET` | `/voice/status` | Returns local chatbot running status. |
| `POST` | `/voice/stop` | Stops local chatbot worker threads. |

### Twilio APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/twilio/call/start` | Starts mode-based outbound call (`daily_checkin`/etc). |
| `POST` | `/twilio/voice/answer` | Twilio webhook: prompt/record orchestration. |
| `POST` | `/twilio/voice/recording` | Twilio webhook: recording ingestion + STT + next-turn logic. |
| `POST` | `/twilio/status` | Twilio status callback; closes sessions. |
| `GET` | `/twilio/call/{call_sid}/state` | Debug endpoint for in-memory call state. |
| `GET` | `/twilio/audio/{filename}` | Static route serving generated WAV prompts for calls. |

## Intended Frontend Integration (Separate Directory/Repo)

Your frontend should treat this backend as the system of record and telephony orchestrator.

### Recommended frontend responsibilities

1. Patient management UI:
   - Call `GET /api/patients`, `POST /api/patients`, `PATCH /api/patients/{id}`.
2. Patient timeline UI:
   - Call `GET /api/patients/{id}/history`.
3. Trigger outbound call workflows:
   - Use `POST /api/call` for patient + custom questions.
   - Or `POST /twilio/call/start` for quick mode-based calls.
4. Optional live call monitoring panel:
   - Poll `GET /twilio/call/{call_sid}/state`.

### Important integration notes

- Twilio webhook endpoints are called by Twilio, not by the frontend directly.
- `PUBLIC_BASE_URL` must point to a public HTTPS URL that Twilio can reach (for example, ngrok).
- If your frontend uses the integrated Next.js proxy route (`/api/doctor/[...path]`), browser CORS is not required for Doctor mode because Vercel calls this backend server-side.

### Vercel + Vultr deployment contract

Use these production roles:

1. Vercel:
      - hosts the Next.js frontend
      - exposes `/api/doctor/*` as a server-side proxy
2. Vultr:
      - runs `uvicorn main:app`
      - exposes the public backend base URL used by Vercel and Twilio

Set these URLs carefully:

1. Frontend `DOCTOR_API_BASE_URL`
      - set this in Vercel to the public Vultr backend origin
      - example: `https://api.your-domain.com`
2. Backend `PUBLIC_BASE_URL`
      - set this on Vultr to that same public backend origin
      - example: `https://api.your-domain.com`

Important:

- `PUBLIC_BASE_URL` must be the backend URL, not the frontend URL.
- Twilio webhooks and `/twilio/audio/*` are served by the backend, so Twilio must reach Vultr directly.
- If `DOCTOR_API_BASE_URL` points anywhere else, the Doctor dashboard on Vercel will fail or proxy back to the wrong service.

## Environment Variables

`main.py` and `voice_chatbot.py` use additional env vars beyond `.env.example`.

### IBM core credentials (required)

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `STT_API_KEY` | Yes | `main.py`, `voice_chatbot.py` | IBM Watson Speech-to-Text key. |
| `STT_URL` | Yes | `main.py`, `voice_chatbot.py` | IBM STT instance URL. |
| `TTS_API_KEY` | Yes | `main.py`, `voice_chatbot.py` | IBM Watson Text-to-Speech key. |
| `TTS_URL` | Yes | `main.py`, `voice_chatbot.py` | IBM TTS instance URL. |
| `IBM_WATSONX_API_KEY` | Yes | `llm_reasoning.py` | WatsonX API key. |
| `IBM_WATSONX_URL` | Yes | `llm_reasoning.py` | WatsonX region endpoint. |
| `IBM_WATSONX_PROJECT_ID` | Yes | `llm_reasoning.py` | WatsonX project id. |
| `IBM_WATSONX_MODEL_ID` | Recommended | `llm_reasoning.py` | Model used for structured reasoning JSON. |

### Twilio + public callback routing

| Variable | Required for Twilio | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio REST auth. |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio REST auth. |
| `TWILIO_FROM_NUMBER` | Yes | Verified Twilio caller number. |
| `PUBLIC_BASE_URL` | Yes | Public HTTPS base used to build Twilio webhook/audio URLs. |

### Optional LLM classification / summaries

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Optional | Used for GPT turn classification during Twilio flows. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o-mini`. |
| `OPENROUTER_API_KEY` | Optional | Used as summary fallback in local voice flow. |

### Voice + Twilio tuning knobs

| Variable | Default | Notes |
|---|---|---|
| `ENABLE_LOCAL_VOICE_CHATBOT` | `0` | Start mic chatbot inside FastAPI process. |
| `MIC_DEVICE_INDEX` | auto | Mic input device index for `voice_chatbot.py`. |
| `TWILIO_FAST_TURNS` | `1` | Use heuristic classifier instead of GPT for speed. |
| `TWILIO_STT_MODEL` | `en-US_Telephony` | STT model for phone recordings. |
| `TWILIO_RECORD_TIMEOUT_SECONDS` | `2` | Silence timeout for `<Record>`. |
| `TWILIO_RECORD_MAX_LENGTH_SECONDS` | `20` | Max per-turn recording duration. |
| `TWILIO_RECORD_TRIM` | `trim-silence` | Twilio record trim behavior. |
| `TWILIO_CACHE_PROMPT_AUDIO` | `1` | Cache synthesized Twilio prompt WAV URLs. |
| `OPENAI_CLASSIFICATION_TIMEOUT_SECONDS` | `3.5` | Timeout for GPT classification call. |

### Database

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | Recommended | Mongo connection string. If set, DB mode is treated as required for key APIs. |

## Data Persistence Behavior

- With DB available:
  - Uses MongoDB collections such as `residents`, `ai_sessions`, and seeded facility-domain collections.
- Without DB:
  - Some patient/session APIs may use in-memory fallback structures.
- If `MONGODB_URI` is set and DB is unavailable:
  - API endpoints that require DB path can return `503` or fail fast.

## Quick Start

### 1) Install dependencies

```bash
cd /home/zayaan/Downloads/App/Backend/GenAI-Genesis-2026
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Linux audio packages (if needed):

```bash
sudo apt install portaudio19-dev python3-dev
```

### 2) Configure environment

```bash
cp .env.example .env
# then add all required values, including Twilio/Mongo vars used in your flow
```

### 3) Run API backend

```bash
cd /home/zayaan/Downloads/App/Backend/GenAI-Genesis-2026
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4) Run local voice chatbot

```bash
cd /home/zayaan/Downloads/App/Backend/GenAI-Genesis-2026
source venv/bin/activate
export MIC_DEVICE_INDEX=5
python voice_chatbot.py
```

If mic capture is weak or silent, run:

```bash
python test_mic.py
```

then set `MIC_DEVICE_INDEX` to a device with strong RMS.

## Example Frontend Calls

Create a patient:

```bash
curl -X POST http://localhost:8000/api/patients \
      -H "Content-Type: application/json" \
      -d '{"firstName":"Eleanor","lastName":"Whitfield","phone":"+16479150931"}'
```

Start custom outbound call for a patient:

```bash
curl -X POST http://localhost:8000/api/call \
      -H "Content-Type: application/json" \
      -d '{
            "patient_id":"demo-patient-001",
            "questions":[
                  "How are you feeling today?",
                  "Are you having any pain?"
            ]
      }'
```

Quick mode-based outbound call:

```bash
curl -X POST http://localhost:8000/twilio/call/start \
      -H "Content-Type: application/json" \
      -d '{"to_number":"+16479150931","mode":"daily_checkin"}'
```

## Operational Notes And Troubleshooting

### IBM TTS 403 (very common)

Symptom:

```text
TTS playback error: Error: Forbidden, Status code: 403
```

Meaning:
- TTS credentials or service-instance permissions are invalid/mismatched.

Verify quickly:

```bash
set -a; source .env; set +a
curl -sS -o /tmp/ibm_tts_check.json -w "HTTP %{http_code}\n" \
      -u "apikey:$TTS_API_KEY" \
      "$TTS_URL/v1/voices"
```

Expected:
- `HTTP 200` for valid TTS credentials.

### Twilio callback issues

- Ensure `PUBLIC_BASE_URL` is public HTTPS and reachable by Twilio.
- Make sure `/twilio/voice/answer`, `/twilio/voice/recording`, and `/twilio/status` are not blocked by local firewall.

### MongoDB connection issues

- Atlas TLS/network misconfiguration can cause connection timeouts or TLS alerts.
- Verify IP allowlist, URI, credentials, and TLS path.

## Development Utilities

- `test_mic.py` checks active input device by RMS.
- `test_llm.py` validates WatsonX JSON response contract.
- `stt_elevenlabs.py` exists as optional/experimental helper and is not wired into `main.py` or `voice_chatbot.py`.

## License

See `LICENSE`.
