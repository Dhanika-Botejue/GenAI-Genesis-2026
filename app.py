import os
import json
import urllib.request
import urllib.parse
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather, Play, Say
from dotenv import load_dotenv
import tts_service
import ai_service
import db

load_dotenv()

app = Flask(__name__)
# Enable CORS for Next.js frontend running on a different port (e.g., 3000)
CORS(app)

# Config
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = '+12265058825' # Hardcoded from twilio-test.py

client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Questions sequence
QUESTIONS = [
    "Hello! This is an AI calling on behalf of your doctor. When did you last check your blood pressure?",
    "Got it. And do you take any medications currently?",
    "Thank you. Have you experienced any dizziness or headaches recently?",
    "Thank you for your time. Your responses have been recorded. Goodbye!"
]

def get_public_url():
    """Attempt to get the ngrok public URL dynamically for the outbound call webhook."""
    try:
        req = urllib.request.Request('http://localhost:4040/api/tunnels')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data['tunnels'][0]['public_url']
    except Exception as e:
        print("Warning: Could not fetch ngrok URL locally. Is ngrok running on 4040?", e)
        return os.getenv("PUBLIC_URL", "http://localhost:5000")

@app.route('/api/data')
def get_data():
    return jsonify(db.read_db())

def make_patient_call(patient_number: str):
    """
    Initiates an outbound call to the given patient number using Twilio.
    The call will start the automated question sequence and can be called 
    programmatically (e.g. from a morning/night scheduler).
    """
    public_url = get_public_url()
    
    webhook_url = f"{public_url}/twilio/twiml?question_idx=0&patient={urllib.parse.quote(patient_number)}"
    print(f"Initiating call to {patient_number} with webhook: {webhook_url}")
    
    try:
        db.clear_patient(patient_number)
        
        call = client.calls.create(
            to=patient_number,
            from_=TWILIO_PHONE_NUMBER,
            url=webhook_url
        )
        print(f"Call initiated successfully: SID {call.sid}")
        return {"success": True, "call_sid": call.sid}
    except Exception as e:
        print(f"Failed to initiate call: {str(e)}")
        return {"success": False, "error": str(e)}

@app.route('/api/call', methods=['POST'])
def initiate_call_route():
    data = request.json
    patient_number = data.get('patient')
    
    if not patient_number:
        return jsonify({"error": "Patient number is required"}), 400

    result = make_patient_call(patient_number)
    
    if result.get("success"):
        return jsonify({"message": "Call initiated", "call_sid": result["call_sid"]}), 200
    else:
        return jsonify({"error": result.get("error")}), 500

@app.route('/twilio/twiml', methods=['POST'])
def twilio_twiml():
    """Initial webhook when the call is answered, or returning to a question."""
    question_idx = int(request.args.get('question_idx', 0))
    patient_number = request.args.get('patient')
    
    # Check if a custom prefix audio file was passed (e.g. "Sure, take your time." for a pause)
    prefix_audio = request.args.get('prefix_audio') 
    
    response = VoiceResponse()
    
    if prefix_audio:
        response.play(f'/audio/{prefix_audio}')
        
    if question_idx < len(QUESTIONS) - 1:
        question_text = QUESTIONS[question_idx]
        audio_file = tts_service.generate_tts(question_text, f"question_{question_idx}.mp3")
        
        gather = Gather(
            input='speech',
            action=f'/twilio/gather?question_idx={question_idx}&patient={urllib.parse.quote(patient_number)}',
            timeout=5,
            speechTimeout='auto'
        )
        gather.play(f'/audio/{audio_file}')
        response.append(gather)
        
        # If no input, loop back and try the same question without prefix
        response.say("I didn't catch that. Please let me know your answer.")
        response.redirect(f'/twilio/twiml?question_idx={question_idx}&patient={urllib.parse.quote(patient_number)}')
    else:
        # Final goodbye question
        question_text = QUESTIONS[-1]
        audio_file = tts_service.generate_tts(question_text, f"question_{question_idx}.mp3")
        response.play(f'/audio/{audio_file}')
        response.hangup()
        
    return Response(str(response), mimetype='text/xml')

@app.route('/twilio/gather', methods=['POST'])
def twilio_gather():
    """Webhook called when patient speaks."""
    question_idx = int(request.args.get('question_idx', 0))
    patient_number = request.args.get('patient')
    
    speech_result = request.form.get('SpeechResult')
    response = VoiceResponse()
    
    if not speech_result:
        # Fallback if somehow empty
        response.redirect(f'/twilio/twiml?question_idx={question_idx}&patient={urllib.parse.quote(patient_number)}')
        return Response(str(response), mimetype='text/xml')
        
    question_text = QUESTIONS[question_idx]
    print(f"[{patient_number}] Q: {question_text} | Spoke: {speech_result}")
    
    # Send directly to OpenAI to interpret what they meant
    eval_result = ai_service.evaluate_response(question_text, speech_result)
    intent = eval_result.get("intent", "answered")
    clean_answer = eval_result.get("clean_answer", speech_result)

    print(f"[{patient_number}] Intent: {intent}")

    if intent == "answered":
        # They answered properly
        db.append_response(patient_number, question_text, clean_answer)
        next_idx = question_idx + 1
        response.redirect(f'/twilio/twiml?question_idx={next_idx}&patient={urllib.parse.quote(patient_number)}')
        
    elif intent == "pause":
        # They asked for a moment
        prefix_audio = tts_service.generate_tts("Sure, take your time.", "pause_prefix.mp3")
        response.redirect(f'/twilio/twiml?question_idx={question_idx}&patient={urllib.parse.quote(patient_number)}&prefix_audio={prefix_audio}')
        
    else: # intent == "noise"
        # Total noise or they said something irrelevant, repeat without saving
        prefix_audio = tts_service.generate_tts("Sorry, I didn't quite get that.", "noise_prefix.mp3")
        response.redirect(f'/twilio/twiml?question_idx={question_idx}&patient={urllib.parse.quote(patient_number)}&prefix_audio={prefix_audio}')
        
    return Response(str(response), mimetype='text/xml')

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory('audio', filename)

if __name__ == '__main__':
    db.init_db()
    os.makedirs('audio', exist_ok=True)
    app.run(port=5000, debug=True)
