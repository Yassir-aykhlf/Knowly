from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", case_sensitive=True
    )

    # Database 
    DATABASE_URL: PostgresDsn
    POSTGRES_USER: str = "knowly"
    POSTGRES_PASSWORD: str = "knowly"
    POSTGRES_DB: str = "knowly"

    # Application 
    SECRET_KEY: str
    SESSION_LIFETIME_DAYS: int = 14
    FRONTEND_ORIGIN: str = "https://localhost"
    EDIT_NOTIFICATION_GRACE_SECONDS: int = 300
    FRIEND_REREQUEST_COOLDOWN_HOURS: int = 0

    # OAuth
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    GOOGLE_OAUTH_REDIRECT_URI: str = "https://localhost/api/auth/google/callback"

    # LLM + moderation
    LLM_PROVIDER: str = "openai"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_RATE_LIMIT_PER_HOUR: int = 30
    MODERATION_ENABLED: bool = True
    MODERATION_THRESHOLD: float = 0.5
    MODERATION_THRESHOLD_OVERRIDES: str = ""

    # Admin 
    INITIAL_ADMIN_EMAIL: str = ""

    # Storage 
    UPLOAD_MAX_BYTES: int = 5_242_880
    AVATAR_MAX_BYTES: int = 2_097_152
    UPLOAD_DIR: str = "/data/uploads"
    AVATAR_DIR: str = "/data/avatars"


settings = Settings()