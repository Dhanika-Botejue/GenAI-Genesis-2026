import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") # Ensure this is added to .env
client = OpenAI(api_key=OPENAI_API_KEY)

def evaluate_response(question: str, user_response: str) -> dict:
    """
    Evaluates the user's spoken response to a specific question using GPT-4o-mini.
    Classifies the intent into one of three categories:
    - 'answered': The user attempted to answer the question.
    - 'pause': The user asked to hold, wait, give them a minute, or said "hold on".
    - 'noise': It was just background noise, a random unrelated word, or an accidental interruption.

    Returns a JSON dictionary, e.g. {"intent": "answered", "clean_answer": "..."}, {"intent": "pause", "clean_answer": ""}, or {"intent": "noise", "clean_answer": ""}
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
        response_format={ "type": "json_object" },
        temperature=0.0
    )
    
    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        # Ensure fallback
        if "intent" not in data:
            return {"intent": "answered", "clean_answer": user_response}
        return data
    except Exception as e:
        print("Failed to parse GPT response:", e)
        return {"intent": "answered", "clean_answer": user_response}
