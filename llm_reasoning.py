import json
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
import re
from config import settings


def get_watsonx_model() -> ModelInference:
    credentials = Credentials(
        url=settings.ibm_watsonx_url,
        api_key=settings.ibm_watsonx_api_key,
    )

    client = APIClient(credentials)

    return ModelInference(
        model_id=settings.ibm_watsonx_model_id,
        project_id=settings.ibm_watsonx_project_id,
        api_client=client,
        params={
            "max_tokens": 400,
            "temperature": 0,
        },
    )


def build_messages(transcript: str, speech_analysis: dict) -> list[dict]:
    return [
        {
            "role": "system",
            "content": (
                "You are an AI assistant for a nursing-home resident monitoring system. "
                "Infer intended meaning from informal patient language. "
                "Use acoustic flags only as supportive evidence. "
                "Do not diagnose. "
                "Return exactly one valid JSON object and nothing else."
                "Do not wrap the JSON in markdown code fences."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Transcript:\n{transcript}\n\n"
                f"Speech analysis:\n{json.dumps(speech_analysis, indent=2)}\n\n"
                "Return JSON with exactly these keys:\n"
                "{\n"
                '  "normalized_symptoms": ["string"],\n'
                '  "speech_pattern_flags": ["string"],\n'
                '  "urgency": "low|medium|urgent",\n'
                '  "reason": "string",\n'
                '  "care_note": "string",\n'
                '  "tts_reply": "string"\n'
                "}"
            ),
        },
    ]
def strip_code_fences(text: str) -> str:
    """Remove markdown code fences if the model wraps its JSON output in them."""
    text = text.strip()
    # Handles ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()

def ask_watsonx(transcript: str, speech_analysis: dict) -> dict:
    model = get_watsonx_model()
    messages = build_messages(transcript, speech_analysis)

    response = model.chat(messages=messages)

    content = response["choices"][0]["message"]["content"]

    # Flatten list content if needed (some model versions return a list of parts)
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )

    # Strip markdown fences before parsing
    content = strip_code_fences(content)

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"LLM returned non-parseable JSON.\nError: {e}\nRaw content:\n{content}"
        ) from e