from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

from config import settings


def get_watsonx_model() -> ModelInference:
    credentials = Credentials(
        url=settings.ibm_watsonx_url,
        api_key=settings.ibm_watsonx_api_key,
    )

    client = APIClient(credentials)

    model = ModelInference(
        model_id=settings.ibm_watsonx_model_id,
        project_id=settings.ibm_watsonx_project_id,
        api_client=client,
    )

    return model


def ask_watsonx(prompt: str) -> str:
    model = get_watsonx_model()
    response = model.generate_text(prompt=prompt)
    return response