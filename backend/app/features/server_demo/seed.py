from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from itertools import islice
from typing import Iterable

from sqlalchemy import delete, insert, text

from app.features.server_demo.models import (
    GridDemoRow,
    ServerDemoCellEvent,
    ServerDemoChangeEvent,
    ServerDemoOperation,
)
from affino_grid_backend.core.revision_models import GridRevision
from app.infrastructure.db.database import AsyncSessionLocal, engine

ROW_COUNT = 100_000
SEGMENTS = ("Core", "Growth", "Enterprise", "SMB")
STATUSES = ("Active", "Paused", "Closed")
REGIONS = ("AMER", "EMEA", "APAC", "LATAM")
BASE_UPDATED_AT = datetime(2025, 1, 1, tzinfo=timezone.utc)
BATCH_SIZE = 5_000


def _row_payloads(
    *,
    workspace_id: str | None = None,
    row_count: int = ROW_COUNT,
    id_prefix: str = "srv",
    row_index_start: int = 0,
) -> Iterable[dict[str, object]]:
    for offset in range(row_count):
        row_index = row_index_start + offset
        yield {
            "id": f"{id_prefix}-{row_index:06d}",
            "workspace_id": workspace_id,
            "row_index": row_index,
            "name": f"Account {row_index:05d}",
            "segment": SEGMENTS[row_index % len(SEGMENTS)],
            "status": STATUSES[row_index % len(STATUSES)],
            "region": REGIONS[row_index % len(REGIONS)],
            "value": (row_index * 97) % 100_000,
            "updated_at": BASE_UPDATED_AT + timedelta(seconds=row_index),
        }


async def seed_demo_rows() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SEQUENCE IF NOT EXISTS server_demo_change_events_id_seq"))
        await conn.run_sync(lambda sync_conn: ServerDemoChangeEvent.__table__.create(sync_conn, checkfirst=True))
        await conn.execute(text('ALTER TABLE server_demo_change_events ADD COLUMN IF NOT EXISTS "rows" JSONB'))
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(delete(ServerDemoCellEvent))
            await session.execute(delete(ServerDemoChangeEvent))
            await session.execute(delete(ServerDemoOperation))
            await session.execute(delete(GridRevision))
            await session.execute(delete(GridDemoRow))

            rows = _row_payloads()
            while True:
                batch = list(islice(rows, BATCH_SIZE))
                if not batch:
                    break
                await session.execute(insert(GridDemoRow), batch)


async def insert_demo_rows(
    *,
    workspace_id: str | None = None,
    row_count: int = 1,
    id_prefix: str = "ws",
    row_index_start: int = 0,
) -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            rows = _row_payloads(
                workspace_id=workspace_id,
                row_count=row_count,
                id_prefix=id_prefix,
                row_index_start=row_index_start,
            )
            while True:
                batch = list(islice(rows, BATCH_SIZE))
                if not batch:
                    break
                await session.execute(insert(GridDemoRow), batch)


def main() -> None:
    asyncio.run(seed_demo_rows())


if __name__ == "__main__":
    main()
