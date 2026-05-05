from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Merlin Backend"
    description: str = "FastAPI backend for Merlin"
    app_version: str = "0.1.0"
    grid_allow_workspace_header_fallback: bool = True
    database_url: str = Field(
        default="postgresql+asyncpg://auctions_dev:auctions_dev_pass@db:5432/auctions_pg"
    )
    db_echo: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
