from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    elevenlabs_api_key: str
    elevenlabs_stt_model_id: str = "eleven_monolingual_v1"
    elevenlabs_tts_model_id: str = "eleven_monolingual_v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()