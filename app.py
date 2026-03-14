import os
import json
import base64
import urllib.request
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather
from dotenv import load_dotenv
import tts_service
import ai_service
import db

load_dotenv()

app = Flask(__name__)
CORS(app)

# Twilio config
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = '+12265058825'

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# In-memory store for active call state (session_id → questions list)
# This is needed because Twilio webhooks are stateless
_active_calls = {}


def get_public_url():
    try:
        req = urllib.request.Request('http://localhost:4040/api/tunnels')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data['tunnels'][0]['public_url']
    except Exception as e:
        print("Warning: Could not fetch ngrok URL:", e)
        return os.getenv("PUBLIC_URL", "http://localhost:5000")


# ── Patient Endpoints ────────────────────────────────────────────────────────

@app.route('/api/patients', methods=['GET'])
def list_patients():
    return jsonify(db.get_patients())


@app.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.json
    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()
    phone = data.get('phone', '').strip()

    if not first_name or not last_name or not phone:
        return jsonify({"error": "firstName, lastName, and phone are required"}), 400

    try:
        patient = db.add_patient(first_name, last_name, phone)
        return jsonify(patient), 201
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return jsonify({"error": "A patient with this phone number already exists"}), 409
        return jsonify({"error": str(e)}), 500


@app.route('/api/patients/<patient_id>/history', methods=['GET'])
def patient_history(patient_id):
    history = db.get_call_history(patient_id)
    return jsonify(history)


# ── Call Endpoints ───────────────────────────────────────────────────────────

@app.route('/api/call', methods=['POST'])
def initiate_call():
    """
    Expects: { patient_id: "...", questions: ["How is your pain?", "Any dizziness?"] }
    1. Looks up patient → gets name + phone
    2. Fetches past call history
    3. Generates personalized GPT greeting
    4. Creates a call_session in MongoDB
    5. Initiates Twilio call
    """
    data = request.json
    patient_id = data.get('patient_id')
    questions = data.get('questions', [])

    if not patient_id:
        return jsonify({"error": "patient_id is required"}), 400
    if not questions or not any(q.strip() for q in questions):
        return jsonify({"error": "At least one question is required"}), 400

    # Clean empty questions
    questions = [q.strip() for q in questions if q.strip()]

    # Look up patient
    patient = db.get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"error": "Patient not found"}), 404

    # Generate personalized greeting
    past_sessions = db.get_call_history(patient_id)
    greeting = ai_service.generate_greeting(patient["firstName"], past_sessions)
    print(f"Generated greeting: {greeting}")

    # Create call session in MongoDB
    session_id = db.create_call_session(patient_id, questions, greeting)
    print(f"Created call session: {session_id}")

    # Store questions in memory for Twilio webhooks
    _active_calls[session_id] = {
        "questions": questions,
        "greeting": greeting,
        "patient_phone": patient["phone"],
        "patient_name": patient["firstName"],
    }

    # Build Twilio webhook URL
    public_url = get_public_url()
    webhook_url = (
        f"{public_url}/twilio/twiml"
        f"?session_id={session_id}"
        f"&question_idx=0"
        f"&patient={urllib.parse.quote(patient['phone'])}"
    )

    try:
        call = twilio_client.calls.create(
            to=patient["phone"],
            from_=TWILIO_PHONE_NUMBER,
            url=webhook_url,
        )
        print(f"Call initiated: SID {call.sid} to {patient['phone']}")
        return jsonify({
            "message": "Call initiated",
            "call_sid": call.sid,
            "session_id": session_id,
        }), 200
    except Exception as e:
        print(f"Failed to initiate call: {e}")
        db.complete_session(session_id)
        return jsonify({"error": str(e)}), 500


@app.route('/twilio/twiml', methods=['POST'])
def twilio_twiml():
    """Twilio webhook: plays greeting (idx 0) or asks question, then gathers speech."""
    session_id = request.args.get('session_id', '')
    question_idx = int(request.args.get('question_idx', 0))
    patient_phone = request.args.get('patient', '')
    prefix_audio = request.args.get('prefix_audio')

    call_state = _active_calls.get(session_id, {})
    questions = call_state.get("questions", [])
    greeting = call_state.get("greeting", "Hello! How are you?")

    response = VoiceResponse()

    # Play prefix audio if passed (e.g. "Sure, take your time.")
    if prefix_audio:
        response.play(f'/audio/{prefix_audio}')

    # STEP 0: Greeting (played before the first question)
    if question_idx == 0:
        greeting_audio = tts_service.generate_tts(greeting, f"greeting_{session_id[:8]}.mp3")
        response.play(f'/audio/{greeting_audio}')

    if question_idx < len(questions):
        # Ask the question
        question_text = questions[question_idx]
        audio_file = tts_service.generate_tts(question_text, f"q_{session_id[:8]}_{question_idx}.mp3")

        gather = Gather(
            input='speech',
            action=(
                f'/twilio/gather'
                f'?session_id={session_id}'
                f'&question_idx={question_idx}'
                f'&patient={urllib.parse.quote(patient_phone)}'
            ),
            timeout=5,
            speechTimeout='auto',
        )
        gather.play(f'/audio/{audio_file}')
        response.append(gather)

        # If no speech detected, retry the same question
        response.say("I didn't catch that. Please let me know your answer.")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
    else:
        # All questions asked — say goodbye
        goodbye_text = "Thank you for your time. Your responses have been recorded. Take care and goodbye!"
        goodbye_audio = tts_service.generate_tts(goodbye_text, f"goodbye_{session_id[:8]}.mp3")
        response.play(f'/audio/{goodbye_audio}')
        response.hangup()

        # Mark session complete
        db.complete_session(session_id)
        # Clean up memory
        _active_calls.pop(session_id, None)

    return Response(str(response), mimetype='text/xml')


@app.route('/twilio/gather', methods=['POST'])
def twilio_gather():
    """Called when patient speaks. Classifies intent and saves clean answers only."""
    session_id = request.args.get('session_id', '')
    question_idx = int(request.args.get('question_idx', 0))
    patient_phone = request.args.get('patient', '')

    speech_result = request.form.get('SpeechResult')
    response = VoiceResponse()

    call_state = _active_calls.get(session_id, {})
    questions = call_state.get("questions", [])

    if not speech_result or question_idx >= len(questions):
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
        return Response(str(response), mimetype='text/xml')

    question_text = questions[question_idx]
    print(f"[{patient_phone}] Q: {question_text} | Spoke: {speech_result}")

    # Classify intent with GPT
    eval_result = ai_service.evaluate_response(question_text, speech_result)
    intent = eval_result.get("intent", "answered")
    clean_answer = eval_result.get("clean_answer", speech_result)

    print(f"[{patient_phone}] Intent: {intent}")

    if intent == "answered":
        # Save ONLY clean answers to MongoDB
        db.save_answer(session_id, question_text, clean_answer)
        next_idx = question_idx + 1
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&question_idx={next_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )

    elif intent == "pause":
        prefix_audio = tts_service.generate_tts("Sure, take your time.", "pause_prefix.mp3")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
            f'&prefix_audio={prefix_audio}'
        )

    else:  # noise
        prefix_audio = tts_service.generate_tts("Sorry, I didn't quite get that.", "noise_prefix.mp3")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
            f'&prefix_audio={prefix_audio}'
        )

    return Response(str(response), mimetype='text/xml')


@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory('audio', filename)


# ── Data endpoint (for frontend polling during active call) ──────────────────

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """Returns the current state of a call session (for live polling)."""
    session = db.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session)


if __name__ == '__main__':
    db.init_db()
    os.makedirs('audio', exist_ok=True)
    app.run(port=5000, debug=True)
