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
    Classifies the patient's spoken response into one of three intents:
    - 'answered': They answered the question → includes a clean_answer field
    - 'pause': They asked for a moment ("hold on", "give me a sec")
    - 'noise': Background noise, gibberish, or unrelated speech

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
    
    Also, if it's "answered", return a "clean_answer" field that summarizes their answer concisely without "uhms" or "ahhs", otherwise leave it blank.
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
            return {"intent": "answered", "clean_answer": user_response}
        return data
    except Exception as e:
        print("Failed to parse GPT response:", e)
        return {"intent": "answered", "clean_answer": user_response}


def generate_greeting(first_name: str, past_sessions: list) -> str:
    """
    Generates a warm, personalized greeting for the patient.
    If there are past calls, GPT will gently reference a previous conversation topic.
    If no past calls, returns a simple friendly hello.
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
        for a in recent["answers"]
    )

    prompt = f"""You are a warm, caring AI health assistant calling a patient named {first_name}.
This is not their first call — here are the questions and answers from their most recent previous call:

{past_qa}

Generate a brief, friendly greeting (2-3 sentences max) that:
1. Says "Hello, {first_name}!"
2. Gently references ONE specific thing from the previous call to show they are remembered
3. Asks how they are doing

Be warm but concise. Do NOT repeat the full medical details — just a light, natural reference.
Return ONLY the greeting text, nothing else."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        greeting = response.choices[0].message.content.strip()
        # Strip any quotes GPT might wrap it in
        if greeting.startswith('"') and greeting.endswith('"'):
            greeting = greeting[1:-1]
        return greeting
    except Exception as e:
        print(f"Greeting generation failed: {e}")
        return f"Hello, {first_name}! How are you doing today?"
