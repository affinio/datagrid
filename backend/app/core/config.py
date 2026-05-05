from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Merlin Backend"
    description: str = "FastAPI backend for Merlin"
    app_version: str = "0.1.0"
    grid_allow_workspace_header_fallback: bool = True
    grid_max_pull_rows: int = Field(default=1000, ge=0)
    grid_max_batch_edits: int = Field(default=500, ge=0)
    grid_max_fill_target_rows: int = Field(default=1000, ge=0)
    grid_max_boundary_scan_limit: int = Field(default=1000, ge=0)
    grid_max_histogram_buckets: int = Field(default=100, ge=0)
    grid_max_fill_source_rows: int = Field(default=100, ge=0)
    grid_max_fill_columns: int = Field(default=50, ge=0)
    grid_max_fill_cells: int = Field(default=5000, ge=0)
    grid_max_filter_count_rows: int | None = Field(default=None, ge=0)
    grid_max_histogram_source_rows: int | None = Field(default=None, ge=0)
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
