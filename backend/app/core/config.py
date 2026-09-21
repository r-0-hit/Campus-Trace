from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. SQLite is a local-only developer fallback."""

    database_url: str = "sqlite:///./campus_trace.db"
    jwt_secret: str = "development-only-change-before-deployment"
    jwt_expiration_minutes: int = 60
    frontend_url: str = "http://localhost:5173"
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: str | None = None
    model_path: str = "ml/models/demo-risk-model.joblib"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
