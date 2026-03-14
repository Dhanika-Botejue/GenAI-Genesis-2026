from pydantic_settings import BaseSettings, SettingsConfigDict
import os 

class Settings(BaseSettings):
    elevenlabs_api_key: str
    elevenlabs_stt_model_id: str = "eleven_monolingual_v1"
    elevenlabs_tts_model_id: str = "eleven_monolingual_v1"
    ibm_watsonx_api_key: str
    ibm_watsonx_url: str
    ibm_watsonx_project_id: str
    ibm_watsonx_model_id: str = os.getenv("IBM_WATSONX_MODEL_ID")
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()