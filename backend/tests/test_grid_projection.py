from __future__ import annotations

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
