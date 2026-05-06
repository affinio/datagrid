from __future__ import annotations

import importlib

import pytest

import affino_grid_backend as agb


PUBLIC_SYMBOLS = {
    "ApiException",
    "GridColumnDefinition",
    "GridColumnRegistry",
    "MutableGridColumnRegistry",
    "GridDataAdapter",
    "GridInvalidation",
    "GridInvalidationReasonMap",
    "GridInvalidationService",
    "GridRangeInvalidation",
    "GridRowsInvalidation",
    "GridRevision",
    "GridRevisionService",
    "GridTableDefinition",
    "GridProjectionService",
    "GridEditServiceBase",
    "GridFillServiceBase",
    "GridHistoryServiceBase",
    "GridCommittedCell",
    "GridFillMutationResult",
    "GridHistoryApplyResult",
    "GridHistoryStatus",
    "GridMutationResult",
    "GridRejectedCell",
    "build_boundary_token",
    "canonical_projection_hash",
}

INTERNAL_SYMBOLS = {
    "PendingGridCellEvent",
    "coerce_optional_int",
    "json_edit_value",
    "normalize_edit_int",
    "normalize_edit_value",
    "normalize_filter_scalar",
    "reject_reason_for_column",
}


@pytest.mark.parametrize("symbol", sorted(PUBLIC_SYMBOLS))
def test_public_package_symbols_are_exported(symbol: str) -> None:
    assert hasattr(agb, symbol)


@pytest.mark.parametrize("symbol", sorted(INTERNAL_SYMBOLS))
def test_internal_helpers_are_not_exported_at_package_root(symbol: str) -> None:
    assert not hasattr(agb, symbol)


def test_subpackage_exports_are_intentional() -> None:
    edits = importlib.import_module("affino_grid_backend.edits")
    fill = importlib.import_module("affino_grid_backend.fill")
    history = importlib.import_module("affino_grid_backend.history")

    assert hasattr(edits, "GridEditServiceBase")
    assert hasattr(edits, "GridMutationResult")
    assert hasattr(fill, "GridFillServiceBase")
    assert hasattr(fill, "GridFillMutationResult")
    assert hasattr(history, "GridHistoryServiceBase")
    assert hasattr(history, "GridHistoryApplyResult")


def test_backend_app_imports_still_work() -> None:
    importlib.import_module("app.main")
