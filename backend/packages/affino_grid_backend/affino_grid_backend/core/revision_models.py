from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, MetaData, String, Table, text


metadata = MetaData()


GridRevision = Table(
    "grid_revisions",
    metadata,
    Column("table_id", String, nullable=False),
    Column("workspace_id", String, nullable=True),
    Column("revision", BigInteger, nullable=False, server_default=text("0")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=text("now()")),
)
