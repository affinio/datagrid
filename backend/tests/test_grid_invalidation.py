from __future__ import annotations

from app.grid.invalidation import GridInvalidationReasonMap, GridInvalidationService


def test_grid_invalidation_empty_indexes_returns_none() -> None:
    service = GridInvalidationService(GridInvalidationReasonMap())

    assert service.build_range_invalidation("edit", []) is None


def test_grid_invalidation_edit_reason() -> None:
    service = GridInvalidationService(GridInvalidationReasonMap())

    invalidation = service.build_range_invalidation("edit", [41, 39, 40])

    assert invalidation is not None
    assert invalidation.kind == "range"
    assert invalidation.range_start == 39
    assert invalidation.range_end == 41
    assert invalidation.reason == "server-demo-edits"


def test_grid_invalidation_fill_reason() -> None:
    service = GridInvalidationService(GridInvalidationReasonMap())

    invalidation = service.build_range_invalidation("fill", [41, 39, 40])

    assert invalidation is not None
    assert invalidation.kind == "range"
    assert invalidation.range_start == 39
    assert invalidation.range_end == 41
    assert invalidation.reason == "server-demo-fill"
