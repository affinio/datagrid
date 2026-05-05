from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.database import Base


class GridDemoRow(Base):
    __tablename__ = "grid_demo_rows"
    __table_args__ = (
        Index("ix_grid_demo_rows_row_index", "row_index"),
        Index("ix_grid_demo_rows_region", "region"),
        Index("ix_grid_demo_rows_segment", "segment"),
        Index("ix_grid_demo_rows_status", "status"),
        Index("ix_grid_demo_rows_value", "value"),
        Index("ix_grid_demo_rows_updated_at", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    segment: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ServerDemoOperation(Base):
    __tablename__ = "server_demo_operations"
    __table_args__ = (
        Index("ix_server_demo_operations_operation_type", "operation_type"),
        Index("ix_server_demo_operations_status", "status"),
        Index("ix_server_demo_operations_created_at", "created_at"),
    )

    operation_id: Mapped[str] = mapped_column(Text, primary_key=True)
    operation_type: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    operation_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    revision: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    modified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ServerDemoCellEvent(Base):
    __tablename__ = "server_demo_cell_events"
    __table_args__ = (
        Index("ix_server_demo_cell_events_operation_id", "operation_id"),
        Index("ix_server_demo_cell_events_row_id", "row_id"),
        Index("ix_server_demo_cell_events_created_at", "created_at"),
    )

    event_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    operation_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("server_demo_operations.operation_id", ondelete="CASCADE"),
        nullable=False,
    )
    row_id: Mapped[str] = mapped_column(Text, nullable=False)
    column_key: Mapped[str] = mapped_column(Text, nullable=False)
    before_value: Mapped[object | None] = mapped_column(JSONB, nullable=True)
    after_value: Mapped[object | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
