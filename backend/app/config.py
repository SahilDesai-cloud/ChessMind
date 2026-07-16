from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    """Ensure SQLAlchemy async driver + SSL for hosted Postgres (e.g. Render)."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    local = "localhost" in url or "127.0.0.1" in url
    if not local and "ssl=" not in url and "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}ssl=require"
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    stockfish_path: str = "stockfish"
    stockfish_depth: int = 15
    stockfish_time_ms: int = 0

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Severity tiers (mover POV, pawns). More negative = worse.
    inaccuracy_threshold: float = -1.0
    mistake_threshold: float = -1.5
    # LLM only for mistakes (or worse). Kept for backward compat.
    explain_eval_threshold: float = -1.5

    database_url: str = (
        "postgresql+asyncpg://chessmind:chessmind@localhost:5432/chessmind"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_db_url(cls, value: object) -> object:
        if isinstance(value, str):
            return _normalize_database_url(value)
        return value


settings = Settings()
