import os
import json
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

# In-memory store for active call state (session_id → call data)
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


# Patient Endpoints 

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


@app.route('/api/patients/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    patient = db.get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(patient)


@app.route('/api/patients/<patient_id>', methods=['PATCH'])
def update_patient(patient_id):
    fields = request.json or {}
    updated = db.update_patient(patient_id, fields)
    if not updated:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(updated)


@app.route('/api/patients/<patient_id>/history', methods=['GET'])
def patient_history(patient_id):
    history = db.get_call_history(patient_id)
    return jsonify(history)


# Call Endpoints

@app.route('/api/call', methods=['POST'])
def initiate_call():
    """
    Expects: { patient_id: "...", questions: ["How is your pain?", "Any dizziness?"] }
    """
    data = request.json
    patient_id = data.get('patient_id')
    questions = data.get('questions', [])

    if not patient_id:
        return jsonify({"error": "patient_id is required"}), 400
    if not questions or not any(q.strip() for q in questions):
        return jsonify({"error": "At least one question is required"}), 400

    questions = [q.strip() for q in questions if q.strip()]

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

    _active_calls[session_id] = {
        "questions": questions,
        "greeting": greeting,
        "patient_phone": patient["phone"],
        "patient_name": patient["firstName"],
    }

    public_url = get_public_url()

    # Start with phase=greeting so the AI greets AND listens for the response
    webhook_url = (
        f"{public_url}/twilio/twiml"
        f"?session_id={session_id}"
        f"&phase=greeting"
        f"&patient={urllib.parse.quote(patient['phone'])}"
    )

    # Status callback so we know when the call ends (even if patient hangs up)
    status_url = f"{public_url}/twilio/status?session_id={session_id}"

    try:
        call = twilio_client.calls.create(
            to=patient["phone"],
            from_=TWILIO_PHONE_NUMBER,
            url=webhook_url,
            status_callback=status_url,
            status_callback_event=["completed"],
            status_callback_method="POST",
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


# ── Twilio Status Callback (fixes "in_progress" stuck bug) ───────────────────

@app.route('/twilio/status', methods=['POST'])
def twilio_status():
    """Called by Twilio when call ends — ensures session is always marked completed."""
    session_id = request.args.get('session_id', '')
    call_status = request.form.get('CallStatus', '')
    print(f"[Status Callback] session={session_id} status={call_status}")

    if session_id:
        db.complete_session(session_id)
        _active_calls.pop(session_id, None)

    return Response("OK", mimetype='text/plain')


# ── Twilio TwiML Webhook ─────────────────────────────────────────────────────

@app.route('/twilio/twiml', methods=['POST'])
def twilio_twiml():
    """
    Two-phase call flow:
      phase=greeting  → Play greeting, Gather patient's response (save as notes)
      phase=questions  → Ask each question one-by-one, Gather answer
    """
    session_id = request.args.get('session_id', '')
    phase = request.args.get('phase', 'questions')
    question_idx = int(request.args.get('question_idx', 0))
    patient_phone = request.args.get('patient', '')
    prefix_audio = request.args.get('prefix_audio')

    call_state = _active_calls.get(session_id, {})
    questions = call_state.get("questions", [])
    greeting = call_state.get("greeting", "Hello! How are you?")

    response = VoiceResponse()

    if prefix_audio:
        response.play(f'/audio/{prefix_audio}')

    # GREETING PHASE: say hello and LISTEN for their response
    if phase == "greeting":
        greeting_audio = tts_service.generate_tts(greeting, f"greeting_{session_id[:8]}.mp3")

        gather = Gather(
            input='speech',
            action=(
                f'/twilio/gather'
                f'?session_id={session_id}'
                f'&phase=greeting'
                f'&patient={urllib.parse.quote(patient_phone)}'
            ),
            timeout=6,
            speechTimeout='auto',
        )
        gather.play(f'/audio/{greeting_audio}')
        response.append(gather)

        # If they don't say anything after 6s, move on to questions
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx=0'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
        return Response(str(response), mimetype='text/xml')

    # QUESTIONS PHASE: ask each custom question
    if question_idx < len(questions):
        question_text = questions[question_idx]
        audio_file = tts_service.generate_tts(question_text, f"q_{session_id[:8]}_{question_idx}.mp3")

        gather = Gather(
            input='speech',
            action=(
                f'/twilio/gather'
                f'?session_id={session_id}'
                f'&phase=questions'
                f'&question_idx={question_idx}'
                f'&patient={urllib.parse.quote(patient_phone)}'
            ),
            timeout=5,
            speechTimeout='auto',
        )
        gather.play(f'/audio/{audio_file}')
        response.append(gather)

        response.say("I didn't catch that. Please let me know your answer.")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
    else:
        # All questions done — say goodbye
        goodbye_text = "Thank you for your time. Your responses have been recorded. Take care and goodbye!"
        goodbye_audio = tts_service.generate_tts(goodbye_text, f"goodbye_{session_id[:8]}.mp3")
        response.play(f'/audio/{goodbye_audio}')
        response.hangup()

        db.complete_session(session_id)
        _active_calls.pop(session_id, None)

    return Response(str(response), mimetype='text/xml')


# Twilio Gather Handler

@app.route('/twilio/gather', methods=['POST'])
def twilio_gather():
    """Handles speech from both greeting and question phases."""
    session_id = request.args.get('session_id', '')
    phase = request.args.get('phase', 'questions')
    question_idx = int(request.args.get('question_idx', 0))
    patient_phone = request.args.get('patient', '')

    speech_result = request.form.get('SpeechResult')
    response = VoiceResponse()

    call_state = _active_calls.get(session_id, {})
    questions = call_state.get("questions", [])
    patient_name = call_state.get("patient_name", "")

    # GREETING RESPONSE: use GPT to reply naturally, then move to questions
    if phase == "greeting":
        if speech_result and speech_result.strip():
            print(f"[{patient_phone}] Greeting response: {speech_result}")
            db.save_greeting_notes(session_id, speech_result.strip())

            # Use GPT to generate a natural reply to whatever they said
            reply = ai_service.generate_greeting_reply(patient_name, speech_result.strip())
            print(f"[{patient_phone}] Greeting reply: {reply}")
            reply_audio = tts_service.generate_tts(reply, f"greeting_reply_{session_id[:8]}.mp3")
            response.play(f'/audio/{reply_audio}')

        # Move on to the first question
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx=0'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
        return Response(str(response), mimetype='text/xml')

    # ── QUESTION RESPONSE: classify intent, save clean answers only ──────
    if not speech_result or question_idx >= len(questions):
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )
        return Response(str(response), mimetype='text/xml')

    question_text = questions[question_idx]
    print(f"[{patient_phone}] Q: {question_text} | Spoke: {speech_result}")

    eval_result = ai_service.evaluate_response(question_text, speech_result)
    intent = eval_result.get("intent", "answered")
    clean_answer = eval_result.get("clean_answer", speech_result)

    print(f"[{patient_phone}] Intent: {intent}")

    if intent == "answered":
        db.save_answer(session_id, question_text, clean_answer)
        next_idx = question_idx + 1

        # Play a sentiment-based transition before the next question
        sentiment = eval_result.get("sentiment", "neutral")
        is_last = next_idx >= len(questions)

        if is_last:
            # No transition needed, goodbye will play from twiml
            pass
        elif sentiment == "positive":
            transition = "That's great to hear!"
            t_audio = tts_service.generate_tts(transition, f"trans_pos_{session_id[:8]}.mp3")
            response.play(f'/audio/{t_audio}')
        elif sentiment == "negative":
            transition = "Oh, I'm sorry to hear that."
            t_audio = tts_service.generate_tts(transition, f"trans_neg_{session_id[:8]}.mp3")
            response.play(f'/audio/{t_audio}')
        else:
            transition = "Got it, thanks for letting me know."
            t_audio = tts_service.generate_tts(transition, f"trans_neu_{session_id[:8]}.mp3")
            response.play(f'/audio/{t_audio}')

        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx={next_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
        )

    elif intent == "pause":
        prefix_audio = tts_service.generate_tts("Sure, take your time.", "pause_prefix.mp3")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
            f'&prefix_audio={prefix_audio}'
        )

    else:  # noise
        prefix_audio = tts_service.generate_tts("Sorry, I didn't quite get that.", "noise_prefix.mp3")
        response.redirect(
            f'/twilio/twiml'
            f'?session_id={session_id}'
            f'&phase=questions'
            f'&question_idx={question_idx}'
            f'&patient={urllib.parse.quote(patient_phone)}'
            f'&prefix_audio={prefix_audio}'
        )

    return Response(str(response), mimetype='text/xml')


@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory('audio', filename)


# ── Session polling endpoint ─────────────────────────────────────────────────

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    session = db.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session)


if __name__ == '__main__':
    db.init_db()
    os.makedirs('audio', exist_ok=True)
    app.run(port=5000, debug=False)
