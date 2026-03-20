import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    stt_api_key: Optional[str] = None
    stt_url: Optional[str] = None
    tts_api_key: Optional[str] = None
    tts_url: Optional[str] = None
    ibm_watsonx_api_key: Optional[str] = None
    ibm_watsonx_url: Optional[str] = None
    ibm_watsonx_project_id: Optional[str] = None
    ibm_watsonx_model_id: str = os.getenv("IBM_WATSONX_MODEL_ID", "ibm/granite-13b-instruct-v2")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def watsonx_configured(self) -> bool:
        return all(
            [
                self.ibm_watsonx_api_key,
                self.ibm_watsonx_url,
                self.ibm_watsonx_project_id,
            ]
        )


settings = Settings()
