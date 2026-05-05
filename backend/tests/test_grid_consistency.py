from __future__ import annotations

from app.grid.consistency import build_boundary_token, canonical_projection_hash


def create_projection_payload(
    *,
    sort_model: list[dict[str, object]] | None = None,
    filter_model: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "sortModel": sort_model or [],
        "filterModel": filter_model,
        "groupBy": None,
        "groupExpansion": {"expandedByDefault": False, "toggledGroupKeys": []},
        "treeData": None,
        "pivot": None,
        "pagination": {
            "snapshot": {
                "enabled": False,
                "pageSize": 50,
                "currentPage": 0,
                "pageCount": 0,
                "totalRowCount": 0,
                "startIndex": 0,
                "endIndex": 49,
            },
            "cursor": None,
        },
    }


def test_canonical_projection_hash_is_stable_for_same_payload() -> None:
    payload = create_projection_payload(
        sort_model=[{"colId": "updated_at", "sort": "desc"}],
        filter_model={"status": {"values": ["Active"]}},
    )

    assert canonical_projection_hash(payload) == canonical_projection_hash(dict(payload))


def test_canonical_projection_hash_changes_for_projection_differences() -> None:
    base_payload = create_projection_payload()
    sort_payload = create_projection_payload(sort_model=[{"colId": "updated_at", "sort": "desc"}])
    filter_payload = create_projection_payload(filter_model={"status": {"values": ["Active"]}})

    assert canonical_projection_hash(base_payload) != canonical_projection_hash(sort_payload)
    assert canonical_projection_hash(base_payload) != canonical_projection_hash(filter_payload)


def test_boundary_token_is_stable_for_same_boundary_payload() -> None:
    payload = {
        "revision": "2026-05-05T00:00:00+00:00",
        "projectionHash": "hash-1",
        "startRowIndex": 10,
        "endRowIndex": 13,
        "endRowId": "srv-000013",
        "boundaryKind": "cache-boundary",
    }

    assert build_boundary_token(payload) == build_boundary_token(dict(payload))
