from __future__ import annotations

from typing import Any, Mapping

from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import ServerDemoRow

MAX_SERVER_DEMO_CHANGE_FEED_ROW_SNAPSHOTS = 100


def serialize_server_demo_row(row: Any) -> ServerDemoRow:
    if isinstance(row, Mapping):
        return ServerDemoRow.model_validate(row)
    return ServerDemoRow(
        id=row.id,
        index=row.row_index,
        name=row.name,
        segment=row.segment,
        status=row.status,
        region=row.region,
        value=row.value,
        updatedAt=row.updated_at,
    )


def serialize_server_demo_rows(rows: list[Any] | tuple[Any, ...] | None) -> list[ServerDemoRow]:
    if not rows:
        return []
    return [serialize_server_demo_row(row) for row in rows if isinstance(row, (GridDemoRowModel, Mapping))]


def should_include_server_demo_change_feed_rows(row_count: int) -> bool:
    return 0 < row_count <= MAX_SERVER_DEMO_CHANGE_FEED_ROW_SNAPSHOTS
