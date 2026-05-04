from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from itertools import islice
from typing import Iterable

from sqlalchemy import delete, insert

from app.features.server_demo.models import GridDemoRow
from app.infrastructure.db.database import AsyncSessionLocal

ROW_COUNT = 100_000
SEGMENTS = ("Core", "Growth", "Enterprise", "SMB")
STATUSES = ("Active", "Paused", "Closed")
REGIONS = ("AMER", "EMEA", "APAC", "LATAM")
BASE_UPDATED_AT = datetime(2025, 1, 1, tzinfo=timezone.utc)
BATCH_SIZE = 5_000


def _row_payloads() -> Iterable[dict[str, object]]:
    for row_index in range(ROW_COUNT):
        yield {
            "id": f"srv-{row_index:06d}",
            "row_index": row_index,
            "name": f"Account {row_index:05d}",
            "segment": SEGMENTS[row_index % len(SEGMENTS)],
            "status": STATUSES[row_index % len(STATUSES)],
            "region": REGIONS[row_index % len(REGIONS)],
            "value": (row_index * 97) % 100_000,
            "updated_at": BASE_UPDATED_AT + timedelta(seconds=row_index),
        }


async def seed_demo_rows() -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(delete(GridDemoRow))

            rows = _row_payloads()
            while True:
                batch = list(islice(rows, BATCH_SIZE))
                if not batch:
                    break
                await session.execute(insert(GridDemoRow), batch)


def main() -> None:
    asyncio.run(seed_demo_rows())


if __name__ == "__main__":
    main()
