from __future__ import annotations

from sqlalchemy import BigInteger, DateTime, Column, String, Table, text

from app.infrastructure.db.database import Base


GridRevision = Table(
    "grid_revisions",
    Base.metadata,
    Column("table_id", String, nullable=False),
    Column("workspace_id", String, nullable=True),
    Column("revision", BigInteger, nullable=False, server_default=text("0")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
)
