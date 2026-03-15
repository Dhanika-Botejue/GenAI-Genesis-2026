from pydantic_settings import BaseSettings, SettingsConfigDict
import os 

class Settings(BaseSettings):
    stt_api_key:str
    stt_url:str
    tts_api_key:str
    tts_url:str
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