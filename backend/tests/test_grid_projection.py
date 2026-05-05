from __future__ import annotations

import pytest

from app.features.server_demo.columns import SERVER_DEMO_COLUMNS
from app.features.server_demo.models import GridDemoRow
from app.grid.projection import GridProjectionService


def test_grid_projection_build_order_by_uses_default_sort_fallback() -> None:
    service = GridProjectionService(model=GridDemoRow, columns=SERVER_DEMO_COLUMNS)

    order_by = service.build_order_by(
        [
            {"colId": "updatedAt", "sort": "desc"},
            {"colId": "bogus", "sort": "asc"},
            {"colId": "value", "sort": "sideways"},
        ]
    )

    assert len(order_by) == 2
    assert order_by[0].element.key == "updated_at"
    assert order_by[1].element.key == "row_index"


@pytest.mark.asyncio
async def test_grid_projection_histogram_entries_truncate_to_configured_limit(
    caplog: pytest.LogCaptureFixture,
) -> None:
    service = GridProjectionService(model=GridDemoRow, columns=SERVER_DEMO_COLUMNS, max_histogram_buckets=2)

    class FakeResult:
        def all(self) -> list[tuple[str, int]]:
            return [("AMER", 1), ("EMEA", 2), ("LATAM", 3)]

    class FakeSession:
        async def execute(self, _stmt: object) -> FakeResult:
            return FakeResult()

    caplog.set_level("WARNING")
    entries = await service.histogram_entries(FakeSession(), "region", None)

    assert entries == [("AMER", 1), ("EMEA", 2)]
    assert any("histogram-truncated" in record.message for record in caplog.records)
