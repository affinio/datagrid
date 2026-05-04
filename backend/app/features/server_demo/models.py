from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
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
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
