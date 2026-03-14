import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_OPENAI_KEY = os.getenv("OPENROUTER_OPENAI_KEY")
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_OPENAI_KEY,
)


def evaluate_response(question: str, user_response: str) -> dict:
    """
    Classifies the patient's spoken response:
    - intent: 'answered' | 'pause' | 'noise'
    - clean_answer: cleaned-up version of their answer (only if answered)
    - sentiment: 'positive' | 'negative' | 'neutral' (only if answered)

    Only 'answered' responses get saved to the database.
    """
    system_prompt = f"""
    You are an AI assistant helping to categorize spoken responses over a phone call for a doctor's office.
    
    The AI patient caller just asked the following question:
    "{question}"
    
    The speech-to-text transcript of what the patient said is:
    "{user_response}"
    
    Categorize the response strictly into one of these intents and return a JSON object.
    
    Intents:
    - "answered": If the user actually responded to the question at hand (e.g. "last week", "yes, advil", "nope"). Even if it's a short response, if it relates to the context, it's an answer.
    - "pause": If the user says something like "hold on", "give me a second", "wait", "let me check".
    - "noise": If the user says something completely unrelated to the question, random gibberish, "ahhh", "umm", or if they said something that implies they didn't hear the question but aren't explicitly asking for a repeat (e.g. "what").
    
    If it's "answered":
    - Return a "clean_answer" field that summarizes their answer concisely without "uhms" or "ahhs".
    - Return a "sentiment" field that is one of: "positive" (happy, good, fine, no problems), "negative" (pain, bad, sad, worried, hurting, something wrong), or "neutral" (factual, neither good nor bad).
    
    If it's not "answered", leave clean_answer blank and sentiment as "neutral".
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.0
    )
    
    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        if "intent" not in data:
            return {"intent": "answered", "clean_answer": user_response, "sentiment": "neutral"}
        if "sentiment" not in data:
            data["sentiment"] = "neutral"
        return data
    except Exception as e:
        print("Failed to parse GPT response:", e)
        return {"intent": "answered", "clean_answer": user_response, "sentiment": "neutral"}


def generate_greeting(first_name: str, past_sessions: list) -> str:
    """
    Generates a SHORT, warm greeting that always ends with asking how they are.
    Must be 1-2 short sentences max so it doesn't get cut off by Twilio TTS.
    """
    if not past_sessions or not any(s.get("answers") for s in past_sessions):
        return f"Hello, {first_name}! How are you doing today?"

    # Build context from the most recent call that had answers
    recent = None
    for s in past_sessions:
        if s.get("answers"):
            recent = s
            break

    if not recent:
        return f"Hello, {first_name}! How are you doing today?"

    past_qa = "\n".join(
        f"Q: {a['question']}\nA: {a['answer']}"
        for a in recent["answers"][:3]  # limit to 3 most recent answers
    )

    prompt = f"""You are a warm, caring AI health assistant calling a patient named {first_name}.
Here is what they said in their most recent previous call:

{past_qa}

Generate a SHORT greeting (max 2 sentences, under 25 words total) that:
1. Says "Hello, {first_name}!"
2. Makes ONE brief, gentle reference to their previous call
3. MUST end by asking "How are you doing today?" or "How are you feeling today?"

CRITICAL RULES:
- MUST be under 25 words total
- MUST end with a question asking how they are
- Do NOT list medical details
- Return ONLY the greeting text, nothing else"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=60,
        )
        greeting = response.choices[0].message.content.strip()
        if greeting.startswith('"') and greeting.endswith('"'):
            greeting = greeting[1:-1]
        return greeting
    except Exception as e:
        print(f"Greeting generation failed: {e}")
        return f"Hello, {first_name}! How are you doing today?"


def generate_greeting_reply(first_name: str, patient_said: str) -> str:
    """
    Uses GPT to generate a natural, kind reply to whatever the patient says
    during the greeting. Handles casual chat, medical mentions, questions, etc.
    Always transitions into 'I have a few questions for you.'
    """
    prompt = f"""You are a warm, caring AI health assistant on a phone call with a patient named {first_name}.
You just said hello and asked how they are. They responded:
"{patient_said}"

Generate a SHORT, natural reply (1-2 sentences max, under 20 words) that:
- If they asked "how are you?" back → say you're doing great, thank them
- If they said something positive → warmly acknowledge it
- If they said something sad or concerning → show empathy briefly
- If they said something casual/unrelated → respond naturally and kindly
- ALWAYS end with something like "I have a few questions for you today." or "Let me go ahead with a couple questions."

CRITICAL: Keep it under 20 words. Be natural, not robotic. Return ONLY the reply text."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=50,
        )
        reply = response.choices[0].message.content.strip()
        if reply.startswith('"') and reply.endswith('"'):
            reply = reply[1:-1]
        return reply
    except Exception as e:
        print(f"Greeting reply generation failed: {e}")
        return "That's nice to hear! I have a few questions for you today."

