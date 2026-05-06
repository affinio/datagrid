from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.features.server_demo.invalidation import ServerDemoInvalidationService
from app.features.server_demo.schemas import ServerDemoEditInvalidation
from app.features.server_demo.models import GridDemoRow, ServerDemoCellEvent, ServerDemoOperation
from app.features.server_demo.seed import seed_demo_rows
from app.features.server_demo.revision import ServerDemoRevisionService
from app.infrastructure.db.database import AsyncSessionLocal
from app.main import app

pytestmark = pytest.mark.asyncio(loop_scope="session")
EXPECTED_SERVER_DEMO_REVISION = "0"
DEFAULT_SERVER_DEMO_WORKSPACE_ID = "server-demo-sandbox"
DEFAULT_SERVER_DEMO_TABLE_ID = "server_demo"


@pytest_asyncio.fixture(scope="module", loop_scope="session", autouse=True)
async def seed_server_demo_edit_rows() -> AsyncIterator[None]:
    await seed_demo_rows()
    yield
    await seed_demo_rows()


@pytest_asyncio.fixture(loop_scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


async def pull_row(client: AsyncClient, row_index: int) -> dict[str, object]:
    response = await client.post(
        "/api/server-demo/pull",
        json={"range": {"startRow": row_index, "endRow": row_index + 1}},
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert len(rows) == 1
    return rows[0]


async def fetch_operation_history(
    operation_id: str,
    workspace_id: str | None = None,
) -> tuple[ServerDemoOperation | None, list[ServerDemoCellEvent]]:
    async with AsyncSessionLocal() as session:
        operation_stmt = select(ServerDemoOperation).where(ServerDemoOperation.operation_id == operation_id)
        if workspace_id is None:
            operation_stmt = operation_stmt.where(ServerDemoOperation.workspace_id.is_(None))
        else:
            operation_stmt = operation_stmt.where(ServerDemoOperation.workspace_id == workspace_id)
        operation_stmt = operation_stmt.where(ServerDemoOperation.table_id == DEFAULT_SERVER_DEMO_TABLE_ID)
        operation = await session.scalar(operation_stmt)
        event_stmt = select(ServerDemoCellEvent).where(ServerDemoCellEvent.operation_id == operation_id)
        events = (
            await session.scalars(
                event_stmt.order_by(ServerDemoCellEvent.created_at.asc(), ServerDemoCellEvent.event_id.asc())
            )
        ).all()
    return operation, list(events)


def server_demo_history_scope(
    *,
    workspace_id: str = DEFAULT_SERVER_DEMO_WORKSPACE_ID,
    user_id: str | None = None,
    session_id: str | None = "server-demo-session",
) -> dict[str, str | None]:
    return {
        "workspace_id": workspace_id,
        "table_id": DEFAULT_SERVER_DEMO_TABLE_ID,
        "user_id": user_id,
        "session_id": session_id,
    }


def create_fill_projection_payload() -> dict[str, object]:
    return {
        "sortModel": [],
        "filterModel": None,
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


async def fetch_fill_boundary_body(
    client: AsyncClient,
    *,
    start_row_index: int,
    limit: int = 3,
) -> dict[str, object]:
    response = await client.post(
        "/api/server-demo/fill-boundary",
        json={
            "direction": "down",
            "baseRange": {"startRow": start_row_index, "endRow": start_row_index, "startColumn": 0, "endColumn": 0},
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "projection": create_fill_projection_payload(),
            "startRowIndex": start_row_index,
            "startColumnIndex": 0,
            "limit": limit,
        },
    )
    assert response.status_code == 200
    return response.json()


async def test_server_demo_revision_is_zero_when_no_rows(client: AsyncClient) -> None:
    service = ServerDemoRevisionService()

    async with AsyncSessionLocal() as session:
        await session.execute(delete(GridDemoRow))
        revision = await service.get_revision(session)
        await session.rollback()

    assert revision == "0"


async def test_server_demo_revision_returns_monotonic_string_when_rows_exist(client: AsyncClient) -> None:
    service = ServerDemoRevisionService()

    async with AsyncSessionLocal() as session:
        revision = await service.get_revision(session)

    assert revision == "0"


async def test_server_demo_invalidation_builds_range_payload() -> None:
    service = ServerDemoInvalidationService()

    invalidation = service.build_range_invalidation("fill", [41, 39, 40])

    assert invalidation is not None
    assert invalidation.kind == "range"
    assert invalidation.range.start == 39
    assert invalidation.range.end == 41
    assert invalidation.reason == "server-demo-fill"


async def test_server_demo_invalidation_builds_rows_payload() -> None:
    service = ServerDemoInvalidationService()

    invalidation = service.build_rows_invalidation("edit", ["srv-000041", "srv-000039", "srv-000040"])

    assert invalidation is not None
    assert invalidation.kind == "rows"
    assert invalidation.row_ids == ["srv-000041", "srv-000039", "srv-000040"]
    assert invalidation.reason == "server-demo-edits"


async def test_server_demo_invalidation_accepts_legacy_range_payload() -> None:
    invalidation = ServerDemoEditInvalidation.model_validate(
        {
            "kind": "range",
            "range": {"start": 3, "end": 7},
            "reason": "server-demo-edits",
        }
    )

    assert invalidation.kind == "range"
    assert invalidation.range is not None
    assert invalidation.range.start == 3
    assert invalidation.range.end == 7
    assert invalidation.row_ids == []


async def test_server_demo_invalidation_returns_none_when_no_indexes() -> None:
    service = ServerDemoInvalidationService()

    assert service.build_range_invalidation("edit", []) is None


async def test_server_demo_single_edit_persists(client: AsyncClient) -> None:
    before = await pull_row(client, 10)
    scope = server_demo_history_scope()

    response = await client.post(
        "/api/server-demo/edits",
        json={
            **scope,
            "edits": [
                {
                    "rowId": "srv-000010",
                    "columnId": "name",
                    "value": "Renamed Account 10",
                    "previousValue": before["name"],
                }
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == ["srv-000010"]
    assert body["committed"] == [
        {
            "rowId": "srv-000010",
            "columnId": "name",
            "revision": body["committed"][0]["revision"],
        }
    ]
    assert body["rejected"] == []
    assert body["revision"]
    assert body["affectedRows"] == 1
    assert body["affectedCells"] == 1
    assert body["canUndo"] is True
    assert body["canRedo"] is False
    assert body["latestUndoOperationId"] == body["operationId"]
    assert body["latestRedoOperationId"] is None
    assert body["invalidation"] == {
        "kind": "rows",
        "range": None,
        "rowIds": ["srv-000010"],
        "reason": "server-demo-edits",
    }
    operation, events = await fetch_operation_history(body["operationId"], scope["workspace_id"])
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert operation.operation_metadata == {}
    assert operation.workspace_id == scope["workspace_id"]
    assert operation.table_id == scope["table_id"]
    assert operation.user_id is None
    assert operation.session_id == scope["session_id"]
    assert len(events) == 1
    assert events[0].row_id == "srv-000010"
    assert events[0].column_key == "name"
    assert events[0].before_value == before["name"]
    assert events[0].after_value == "Renamed Account 10"

    status_response = await client.post("/api/history/status", json=scope)
    assert status_response.status_code == 200
    status_body = status_response.json()
    assert status_body["canUndo"] is True
    assert status_body["canRedo"] is False

    after = await pull_row(client, 10)
    assert after["name"] == "Renamed Account 10"
    assert after["updatedAt"] != before["updatedAt"]


async def test_server_demo_batch_edit_persists(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {"rowId": "srv-000020", "columnId": "segment", "value": "SMB"},
                {"rowId": "srv-000021", "columnId": "status", "value": "Paused"},
                {"rowId": "srv-000021", "columnId": "region", "value": "LATAM"},
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == ["srv-000020", "srv-000021"]
    assert [(entry["rowId"], entry["columnId"]) for entry in body["committed"]] == [
        ("srv-000020", "segment"),
        ("srv-000021", "status"),
        ("srv-000021", "region"),
    ]
    assert body["rejected"] == []
    assert body["invalidation"] == {
        "kind": "rows",
        "range": None,
        "rowIds": ["srv-000020", "srv-000021"],
        "reason": "server-demo-edits",
    }
    operation, events = await fetch_operation_history(body["operationId"])
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert operation.operation_metadata == {}
    assert sorted((event.row_id, event.column_key) for event in events) == [
        ("srv-000020", "segment"),
        ("srv-000021", "region"),
        ("srv-000021", "status"),
    ]

    row_20 = await pull_row(client, 20)
    row_21 = await pull_row(client, 21)
    assert row_20["segment"] == "SMB"
    assert row_21["status"] == "Paused"
    assert row_21["region"] == "LATAM"


async def test_server_demo_large_batch_edit_persists_with_range_invalidation(client: AsyncClient) -> None:
    edits = [
        {
            "rowId": f"srv-{row_index:06d}",
            "columnId": "name",
            "value": f"Bulk Edited Account {row_index}",
        }
        for row_index in range(200, 251)
    ]

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": edits},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == [f"srv-{row_index:06d}" for row_index in range(200, 251)]
    assert body["rejected"] == []
    assert body["invalidation"] == {
        "kind": "range",
        "range": {"start": 200, "end": 250},
        "rowIds": [],
        "reason": "server-demo-edits",
    }


async def test_server_demo_batch_edit_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {"rowId": "srv-000020", "columnId": "status", "value": "Paused"}
                for _ in range(501)
            ]
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "too-many-edits",
        "message": "Batch edit size exceeds limit",
    }


async def test_server_demo_fill_source_rows_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "revision": "rev-before",
            "sourceRange": {"startRow": 0, "endRow": 100, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": [f"srv-{row_index:06d}" for row_index in range(101)],
            "targetRowIds": ["srv-000000"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "fill-source-too-large",
        "message": "Fill source range exceeds maximum allowed size",
    }


async def test_server_demo_fill_column_count_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "revision": "rev-before",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000000"],
            "targetRowIds": ["srv-000001"],
            "fillColumns": [f"fill-{index:02d}" for index in range(51)],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "too-many-fill-columns",
        "message": "Fill column count exceeds maximum allowed size",
    }


async def test_server_demo_fill_reference_column_count_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "revision": "rev-before",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000000"],
            "targetRowIds": ["srv-000001"],
            "fillColumns": ["status"],
            "referenceColumns": [f"ref-{index:02d}" for index in range(51)],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "too-many-reference-columns",
        "message": "Reference column count exceeds maximum allowed size",
    }


async def test_server_demo_fill_cell_fan_out_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "revision": "rev-before",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 100, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000000"],
            "targetRowIds": [f"srv-{row_index:06d}" for row_index in range(101)],
            "fillColumns": [f"fill-{index:02d}" for index in range(50)],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "fill-cell-count-too-large",
        "message": "Fill cell count exceeds maximum allowed size",
    }


async def test_server_demo_move_like_batch_persists_source_clear_and_target_write(client: AsyncClient) -> None:
    operation_id = "test-move-like-batch"
    source_before = await pull_row(client, 110)
    target_before = await pull_row(client, 111)
    scope = server_demo_history_scope()

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            **scope,
            "edits": [
                {"rowId": "srv-000110", "columnId": "status", "value": ""},
                {"rowId": "srv-000111", "columnId": "status", "value": "Paused"},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["committedRowIds"] == ["srv-000110", "srv-000111"]
    assert body["rejected"] == []
    assert [(entry["rowId"], entry["columnId"]) for entry in body["committed"]] == [
        ("srv-000110", "status"),
        ("srv-000111", "status"),
    ]

    source_after = await pull_row(client, 110)
    target_after = await pull_row(client, 111)
    assert source_after["status"] == ""
    assert target_after["status"] == "Paused"

    operation, events = await fetch_operation_history(operation_id, scope["workspace_id"])
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert len(events) == 2
    assert sorted((event.row_id, event.column_key) for event in events) == [
        ("srv-000110", "status"),
        ("srv-000111", "status"),
    ]
    events_by_row = {event.row_id: event for event in events}
    assert events_by_row["srv-000110"].before_value == source_before["status"]
    assert events_by_row["srv-000110"].after_value == ""
    assert events_by_row["srv-000111"].before_value == target_before["status"]
    assert events_by_row["srv-000111"].after_value == "Paused"

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    undo_body = undo_response.json()
    assert undo_body["operationId"] == operation_id
    assert sorted(undo_body["committedRowIds"]) == ["srv-000110", "srv-000111"]
    assert undo_body["rejected"] == []
    assert (await pull_row(client, 110))["status"] == source_before["status"]
    assert (await pull_row(client, 111))["status"] == target_before["status"]

    redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert redo_response.status_code == 200
    redo_body = redo_response.json()
    assert redo_body["operationId"] == operation_id
    assert sorted(redo_body["committedRowIds"]) == ["srv-000110", "srv-000111"]
    assert redo_body["rejected"] == []
    assert (await pull_row(client, 110))["status"] == ""
    assert (await pull_row(client, 111))["status"] == "Paused"


async def test_server_demo_invalid_column_edit_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {"rowId": "srv-000030", "columnId": "id", "value": "srv-hacked"},
                {"rowId": "srv-000030", "columnId": "updatedAt", "value": "2026-01-01T00:00:00Z"},
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000030", "columnId": "id", "reason": "readonly-column"},
        {"rowId": "srv-000030", "columnId": "updatedAt", "reason": "readonly-column"},
    ]
    assert body["invalidation"] is None

    row = await pull_row(client, 30)
    assert row["id"] == "srv-000030"


async def test_server_demo_unknown_column_edit_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000030", "columnId": "does_not_exist", "value": "x"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["rejected"] == [
        {"rowId": "srv-000030", "columnId": "does_not_exist", "reason": "unsupported-column"}
    ]
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["invalidation"] is None


async def test_server_demo_invalid_enum_edit_is_rejected(client: AsyncClient) -> None:
    before = await pull_row(client, 40)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000040", "columnId": "status", "value": "Archived"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000040", "columnId": "status", "reason": "invalid-enum-value"}
    ]
    assert body["invalidation"] is None

    after = await pull_row(client, 40)
    assert after["status"] == before["status"]
    assert after["updatedAt"] == before["updatedAt"]


async def test_server_demo_invalid_integer_edit_is_rejected(client: AsyncClient) -> None:
    before = await pull_row(client, 51)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000051", "columnId": "value", "value": "12.5"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000051", "columnId": "value", "reason": "invalid-integer-value"}
    ]
    assert body["invalidation"] is None

    after = await pull_row(client, 51)
    assert after["value"] == before["value"]


async def test_server_demo_previous_value_mismatch_is_rejected(client: AsyncClient) -> None:
    before = await pull_row(client, 52)

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000052",
                    "columnId": "name",
                    "value": "Mismatch Guard 52",
                    "previousValue": "not-the-current-value",
                }
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000052", "columnId": "name", "reason": "previous-value-mismatch"}
    ]
    assert body["invalidation"] is None

    after = await pull_row(client, 52)
    assert after["name"] == before["name"]
    assert after["updatedAt"] == before["updatedAt"]


async def test_server_demo_value_edit_persists_as_integer(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000050", "columnId": "value", "value": "12345"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == ["srv-000050"]
    assert body["rejected"] == []

    row = await pull_row(client, 50)
    assert row["value"] == 12345


async def test_server_demo_duplicate_operation_id_is_rejected(client: AsyncClient) -> None:
    operation_id = "test-duplicate-edit-operation"

    first_response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [{"rowId": "srv-000053", "columnId": "name", "value": "Duplicate Guard 53"}],
        },
    )

    assert first_response.status_code == 200
    assert first_response.json()["operationId"] == operation_id

    second_response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [{"rowId": "srv-000054", "columnId": "name", "value": "Duplicate Guard 54"}],
        },
    )

    assert second_response.status_code == 409
    assert second_response.json()["code"] == "duplicate-operation-id"


async def test_server_demo_noop_edit_still_creates_operation_and_event(client: AsyncClient) -> None:
    before = await pull_row(client, 55)

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": "test-noop-edit",
            "edits": [{"rowId": "srv-000055", "columnId": "name", "value": before["name"]}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == "test-noop-edit"
    assert body["committedRowIds"] == ["srv-000055"]
    assert body["rejected"] == []

    operation, events = await fetch_operation_history("test-noop-edit")
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert len(events) == 1
    assert events[0].row_id == "srv-000055"
    assert events[0].column_key == "name"
    assert events[0].before_value == before["name"]
    assert events[0].after_value == before["name"]

    after = await pull_row(client, 55)
    assert after["name"] == before["name"]
    assert after["updatedAt"] == before["updatedAt"]


async def test_server_demo_value_edit_can_be_cleared_with_empty_string(client: AsyncClient) -> None:
    before = await pull_row(client, 500)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000500", "columnId": "value", "value": ""}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == ["srv-000500"]
    assert body["rejected"] == []

    after = await pull_row(client, 500)
    assert after["value"] is None
    assert after["updatedAt"] != before["updatedAt"]

    sorted_response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 5},
            "sortModel": [{"colId": "value", "sort": "asc"}],
        },
    )
    assert sorted_response.status_code == 200

    filtered_response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 5},
            "filterModel": {"value": {"type": "greaterThan", "filter": 0}},
        },
    )
    assert filtered_response.status_code == 200


async def test_server_demo_value_edit_can_be_cleared_with_null(client: AsyncClient) -> None:
    before = await pull_row(client, 501)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000501", "columnId": "value", "value": None}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["committedRowIds"] == ["srv-000501"]
    assert body["rejected"] == []

    after = await pull_row(client, 501)
    assert after["value"] is None
    assert after["updatedAt"] != before["updatedAt"]


async def test_server_demo_value_move_like_batch_clears_source_and_restores_with_history(client: AsyncClient) -> None:
    operation_id = "test-value-move-like-batch"
    source_before = await pull_row(client, 502)
    target_before = await pull_row(client, 503)

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [
                {"rowId": "srv-000502", "columnId": "value", "value": ""},
                {"rowId": "srv-000503", "columnId": "value", "value": source_before["value"]},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["committedRowIds"] == ["srv-000502", "srv-000503"]
    assert body["rejected"] == []
    assert [(entry["rowId"], entry["columnId"]) for entry in body["committed"]] == [
        ("srv-000502", "value"),
        ("srv-000503", "value"),
    ]

    source_after = await pull_row(client, 502)
    target_after = await pull_row(client, 503)
    assert source_after["value"] is None
    assert target_after["value"] == source_before["value"]

    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert len(events) == 2
    assert sorted((event.row_id, event.column_key) for event in events) == [
        ("srv-000502", "value"),
        ("srv-000503", "value"),
    ]
    events_by_row = {event.row_id: event for event in events}
    assert events_by_row["srv-000502"].before_value == source_before["value"]
    assert events_by_row["srv-000502"].after_value is None
    assert events_by_row["srv-000503"].before_value == target_before["value"]
    assert events_by_row["srv-000503"].after_value == source_before["value"]

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    undo_body = undo_response.json()
    assert undo_body["operationId"] == operation_id
    assert sorted(undo_body["committedRowIds"]) == ["srv-000502", "srv-000503"]
    assert undo_body["rejected"] == []
    assert (await pull_row(client, 502))["value"] == source_before["value"]
    assert (await pull_row(client, 503))["value"] == target_before["value"]

    redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert redo_response.status_code == 200
    redo_body = redo_response.json()
    assert redo_body["operationId"] == operation_id
    assert sorted(redo_body["committedRowIds"]) == ["srv-000502", "srv-000503"]
    assert redo_body["rejected"] == []
    assert (await pull_row(client, 502))["value"] is None
    assert (await pull_row(client, 503))["value"] == source_before["value"]


async def test_server_demo_edit_persists_after_repeated_pull(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000060", "columnId": "name", "value": "Reloaded Account 60"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"]
    assert body["rejected"] == []

    first_pull = await pull_row(client, 60)
    second_pull = await pull_row(client, 60)
    assert first_pull["name"] == "Reloaded Account 60"
    assert second_pull["name"] == "Reloaded Account 60"


async def test_server_demo_single_edit_undo_and_redo(client: AsyncClient) -> None:
    operation_id = "test-single-edit-undo-redo"
    before = await pull_row(client, 70)

    edit_response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [
                {
                    "rowId": "srv-000070",
                    "columnId": "name",
                    "value": "Undoable Account 70",
                }
            ],
        },
    )

    assert edit_response.status_code == 200
    edit_body = edit_response.json()
    assert edit_body["operationId"] == operation_id
    assert edit_body["committedRowIds"] == ["srv-000070"]
    assert (await pull_row(client, 70))["name"] == "Undoable Account 70"

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    undo_body = undo_response.json()
    assert undo_body["operationId"] == operation_id
    assert undo_body["committedRowIds"] == ["srv-000070"]
    assert undo_body["rejected"] == []
    assert undo_body["invalidation"] == {
        "kind": "rows",
        "range": None,
        "rowIds": ["srv-000070"],
        "reason": "server-demo-edits",
    }
    assert (await pull_row(client, 70))["name"] == before["name"]
    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.status == "undone"
    assert len(events) == 1

    second_undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert second_undo_response.status_code == 409
    assert second_undo_response.json()["code"] == "operation-already-undone"

    redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert redo_response.status_code == 200
    redo_body = redo_response.json()
    assert redo_body["operationId"] == operation_id
    assert redo_body["committedRowIds"] == ["srv-000070"]
    assert redo_body["rejected"] == []
    assert redo_body["invalidation"] == {
        "kind": "rows",
        "range": None,
        "rowIds": ["srv-000070"],
        "reason": "server-demo-edits",
    }
    assert (await pull_row(client, 70))["name"] == "Undoable Account 70"
    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.status == "applied"
    assert len(events) == 1

    second_redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert second_redo_response.status_code == 409
    assert second_redo_response.json()["code"] == "operation-not-undone"


async def test_server_demo_batch_edit_undo_and_redo(client: AsyncClient) -> None:
    operation_id = "test-batch-edit-undo-redo"
    before_80 = await pull_row(client, 80)
    before_81 = await pull_row(client, 81)

    edit_response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [
                {"rowId": "srv-000080", "columnId": "segment", "value": "Enterprise"},
                {"rowId": "srv-000081", "columnId": "status", "value": "Closed"},
                {"rowId": "srv-000081", "columnId": "value", "value": 818181},
            ],
        },
    )

    assert edit_response.status_code == 200
    edit_body = edit_response.json()
    assert edit_body["operationId"] == operation_id
    assert edit_body["committedRowIds"] == ["srv-000080", "srv-000081"]

    row_80 = await pull_row(client, 80)
    row_81 = await pull_row(client, 81)
    assert row_80["segment"] == "Enterprise"
    assert row_81["status"] == "Closed"
    assert row_81["value"] == 818181
    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.status == "applied"
    assert len(events) == 3

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    undo_body = undo_response.json()
    assert undo_body["operationId"] == operation_id
    assert sorted(undo_body["committedRowIds"]) == ["srv-000080", "srv-000081"]
    assert sorted((entry["rowId"], entry["columnId"]) for entry in undo_body["committed"]) == [
        ("srv-000080", "segment"),
        ("srv-000081", "status"),
        ("srv-000081", "value"),
    ]
    assert undo_body["rejected"] == []
    assert (await pull_row(client, 80))["segment"] == before_80["segment"]
    restored_81 = await pull_row(client, 81)
    assert restored_81["status"] == before_81["status"]
    assert restored_81["value"] == before_81["value"]
    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.status == "undone"
    assert len(events) == 3

    redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert redo_response.status_code == 200
    redo_body = redo_response.json()
    assert redo_body["operationId"] == operation_id
    assert sorted(redo_body["committedRowIds"]) == ["srv-000080", "srv-000081"]
    assert redo_body["rejected"] == []
    redone_80 = await pull_row(client, 80)
    redone_81 = await pull_row(client, 81)
    assert redone_80["segment"] == "Enterprise"
    assert redone_81["status"] == "Closed"
    assert redone_81["value"] == 818181
    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.status == "applied"
    assert len(events) == 3


async def test_server_demo_undo_missing_operation_returns_404(client: AsyncClient) -> None:
    response = await client.post("/api/server-demo/operations/missing-operation/undo")

    assert response.status_code == 404
    assert response.json()["code"] == "operation-not-found"


async def test_server_demo_redo_before_undo_is_rejected(client: AsyncClient) -> None:
    operation_id = "test-redo-before-undo"

    edit_response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [{"rowId": "srv-000090", "columnId": "name", "value": "Redo Guard 90"}],
        },
    )

    assert edit_response.status_code == 200
    response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")

    assert response.status_code == 409
    assert response.json()["code"] == "operation-not-undone"


async def test_server_demo_undo_invalid_operation_id_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/server-demo/operations/%20%20/undo")

    assert response.status_code == 400
    assert response.json()["code"] == "invalid-operation-id"


async def test_server_demo_operation_with_no_cell_events_is_rejected(client: AsyncClient) -> None:
    operation_id = "test-no-cell-events"

    async with AsyncSessionLocal() as session:
        session.add(
            ServerDemoOperation(
                operation_id=operation_id,
                workspace_id=DEFAULT_SERVER_DEMO_WORKSPACE_ID,
                table_id=DEFAULT_SERVER_DEMO_TABLE_ID,
                operation_type="edit",
                status="applied",
                operation_metadata={},
                revision=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                modified_at=datetime.now(timezone.utc),
            )
        )
        await session.commit()

    response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")

    assert response.status_code == 409
    assert response.json()["code"] == "operation-has-no-cell-events"


async def test_server_demo_partial_success_records_only_committed_cell_events(client: AsyncClient) -> None:
    operation_id = "test-partial-success-history"
    scope = server_demo_history_scope()

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            **scope,
            "edits": [
                {"rowId": "srv-000091", "columnId": "name", "value": "Partially Committed 91"},
                {"rowId": "srv-000091", "columnId": "id", "value": "srv-hacked"},
                {"rowId": "srv-000092", "columnId": "status", "value": "Archived"},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["committedRowIds"] == ["srv-000091"]
    assert body["committed"] == [
        {
            "rowId": "srv-000091",
            "columnId": "name",
            "revision": body["committed"][0]["revision"],
        }
    ]
    assert body["rejected"] == [
        {"rowId": "srv-000091", "columnId": "id", "reason": "readonly-column"},
        {"rowId": "srv-000092", "columnId": "status", "reason": "invalid-enum-value"},
    ]

    scope = server_demo_history_scope()
    operation, events = await fetch_operation_history(operation_id, scope["workspace_id"])
    assert operation is not None
    assert operation.operation_type == "edit"
    assert operation.status == "applied"
    assert len(events) == 1
    assert events[0].row_id == "srv-000091"
    assert events[0].column_key == "name"
    assert events[0].after_value == "Partially Committed 91"
    assert (await pull_row(client, 91))["name"] == "Partially Committed 91"


async def test_server_demo_all_rejected_edit_creates_no_operation(client: AsyncClient) -> None:
    operation_id = "test-all-rejected-history"

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "operationId": operation_id,
            "edits": [
                {"rowId": "srv-000093", "columnId": "id", "value": "srv-hacked"},
                {"rowId": "srv-000094", "columnId": "status", "value": "Archived"},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000093", "columnId": "id", "reason": "readonly-column"},
        {"rowId": "srv-000094", "columnId": "status", "reason": "invalid-enum-value"},
    ]
    assert body["invalidation"] is None

    operation, events = await fetch_operation_history(operation_id)
    assert operation is None
    assert events == []


async def test_server_demo_fill_boundary_basic_down(client: AsyncClient) -> None:
    request_body = {
        "direction": "down",
        "baseRange": {"startRow": 10, "endRow": 10, "startColumn": 0, "endColumn": 0},
        "fillColumns": ["status"],
        "referenceColumns": ["status"],
        "projection": create_fill_projection_payload(),
        "startRowIndex": 11,
        "startColumnIndex": 0,
        "limit": 3,
    }
    response = await client.post(
        "/api/server-demo/fill-boundary",
        json=request_body,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["endRowIndex"] == 13
    assert body["endRowId"] == "srv-000013"
    assert body["boundaryKind"] == "cache-boundary"
    assert body["scannedRowCount"] == 3
    assert body["truncated"] is True
    assert body["revision"]
    assert body["projectionHash"]
    assert body["boundaryToken"]

    repeat_response = await client.post("/api/server-demo/fill-boundary", json=request_body)
    assert repeat_response.status_code == 200
    repeat_body = repeat_response.json()
    assert repeat_body["projectionHash"] == body["projectionHash"]
    assert repeat_body["boundaryToken"] == body["boundaryToken"]


async def test_server_demo_fill_boundary_respects_max_scan_limit(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill-boundary",
        json={
            "direction": "down",
            "baseRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "fillColumns": ["status"],
            "referenceColumns": ["name"],
            "projection": create_fill_projection_payload(),
            "startRowIndex": 0,
            "startColumnIndex": 0,
            "limit": 5000,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["scannedRowCount"] == 1000
    assert body["truncated"] is True
    assert body["boundaryKind"] == "cache-boundary"


async def test_server_demo_fill_commit_exceeding_limit_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "test-fill-too-many-target-rows",
            "revision": "rev-before",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 1000, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000000"],
            "targetRowIds": [f"srv-{row_index:06d}" for row_index in range(1001)],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "fill-range-too-large",
        "message": "Fill range exceeds maximum allowed size",
    }


async def test_server_demo_fill_boundary_hash_changes_with_projection(client: AsyncClient) -> None:
    base_request = {
        "direction": "down",
        "baseRange": {"startRow": 10, "endRow": 10, "startColumn": 0, "endColumn": 0},
        "fillColumns": ["status"],
        "referenceColumns": ["status"],
        "startRowIndex": 11,
        "startColumnIndex": 0,
        "limit": 3,
    }

    same_projection = create_fill_projection_payload()
    alt_sort_projection = {**same_projection, "sortModel": [{"colId": "updated_at", "sort": "desc"}]}
    alt_filter_projection = {**same_projection, "filterModel": {"status": {"values": ["Active"]}}}

    same_response = await client.post(
        "/api/server-demo/fill-boundary",
        json={**base_request, "projection": same_projection},
    )
    sort_response = await client.post(
        "/api/server-demo/fill-boundary",
        json={**base_request, "projection": alt_sort_projection},
    )
    filter_response = await client.post(
        "/api/server-demo/fill-boundary",
        json={**base_request, "projection": alt_filter_projection},
    )

    assert same_response.status_code == 200
    assert sort_response.status_code == 200
    assert filter_response.status_code == 200
    assert same_response.json()["projectionHash"] != sort_response.json()["projectionHash"]
    assert same_response.json()["projectionHash"] != filter_response.json()["projectionHash"]


async def test_server_demo_fill_commit_copy_single_column_with_history(client: AsyncClient) -> None:
    operation_id = "test-fill-copy-single-column"
    source_before = await pull_row(client, 20)
    target_before = await pull_row(client, 21)
    scope = server_demo_history_scope()
    boundary_response = await client.post(
        "/api/server-demo/fill-boundary",
        json={
            "direction": "down",
            "baseRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "projection": create_fill_projection_payload(),
            "startRowIndex": 20,
            "startColumnIndex": 0,
            "limit": 3,
        },
    )
    assert boundary_response.status_code == 200
    boundary_body = boundary_response.json()

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            **scope,
            "revision": "rev-before",
            "baseRevision": boundary_body["revision"],
            "projectionHash": boundary_body["projectionHash"],
            "sourceRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 20, "endRow": 21, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000020"],
            "targetRowIds": ["srv-000020", "srv-000021"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
            "metadata": {
                "origin": "double-click-fill",
                "behaviorSource": "default",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["affectedRowCount"] == 1
    assert body["affectedCellCount"] == 1
    assert body["affectedRows"] == 1
    assert body["affectedCells"] == 1
    assert body["canUndo"] is True
    assert body["canRedo"] is False
    assert body["latestUndoOperationId"] == operation_id
    assert body["latestRedoOperationId"] is None
    assert body["warnings"] == []
    assert body["invalidation"] == {
        "kind": "rows",
        "range": None,
        "rowIds": ["srv-000021"],
        "reason": "server-demo-fill",
    }

    after = await pull_row(client, 21)
    assert after["status"] == source_before["status"]
    assert after["updatedAt"] != target_before["updatedAt"]

    operation, events = await fetch_operation_history(operation_id, scope["workspace_id"])
    assert operation is not None
    assert operation.operation_type == "fill"
    assert operation.status == "applied"
    assert operation.workspace_id == scope["workspace_id"]
    assert operation.table_id == scope["table_id"]
    assert operation.user_id is None
    assert operation.session_id == scope["session_id"]
    assert operation.operation_metadata == {
        "sourceRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
        "targetRange": {"startRow": 20, "endRow": 21, "startColumn": 0, "endColumn": 0},
        "sourceRowIds": ["srv-000020"],
        "targetRowIds": ["srv-000020", "srv-000021"],
        "fillColumns": ["status"],
        "referenceColumns": ["status"],
        "mode": "copy",
        "projection": create_fill_projection_payload(),
        "metadata": {
            "origin": "double-click-fill",
            "behaviorSource": "default",
        },
    }
    assert len(events) == 1
    assert events[0].row_id == "srv-000021"
    assert events[0].column_key == "status"
    assert events[0].before_value == target_before["status"]
    assert events[0].after_value == source_before["status"]

    status_response = await client.post("/api/history/status", json=scope)
    assert status_response.status_code == 200
    status_body = status_response.json()
    assert status_body["canUndo"] is True
    assert status_body["canRedo"] is False

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    assert (await pull_row(client, 21))["status"] == target_before["status"]

    redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo")
    assert redo_response.status_code == 200
    assert (await pull_row(client, 21))["status"] == source_before["status"]


async def test_server_demo_fill_commit_large_result_uses_range_invalidation(client: AsyncClient) -> None:
    operation_id = "test-fill-copy-range-invalidation"
    source_before = await pull_row(client, 300)
    target_row_ids = [f"srv-{row_index:06d}" for row_index in range(301, 353)]

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "revision": "rev-before",
            "sourceRange": {"startRow": 300, "endRow": 300, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 301, "endRow": 352, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000300"],
            "targetRowIds": target_row_ids,
            "fillColumns": ["name"],
            "referenceColumns": ["name"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["affectedRowCount"] == 52
    assert body["warnings"] == []
    assert body["invalidation"] == {
        "kind": "range",
        "range": {"start": 301, "end": 352},
        "rowIds": [],
        "reason": "server-demo-fill",
    }

    row_301 = await pull_row(client, 301)
    assert row_301["name"] == source_before["name"]


async def test_server_demo_fill_commit_accepts_optional_consistency_metadata_without_behavior_change(
    client: AsyncClient,
) -> None:
    operation_id = "test-fill-copy-metadata"
    boundary_body = await fetch_fill_boundary_body(client, start_row_index=120)
    end_row_index = boundary_body["endRowIndex"]
    assert isinstance(end_row_index, int)
    target_row_ids = [f"srv-{row_index:06d}" for row_index in range(120, end_row_index + 1)]

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "revision": "rev-before",
            "baseRevision": boundary_body["revision"],
            "projectionHash": boundary_body["projectionHash"],
            "boundaryToken": boundary_body["boundaryToken"],
            "sourceRange": {"startRow": 120, "endRow": 120, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 120, "endRow": end_row_index, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000120"],
            "targetRowIds": target_row_ids,
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["warnings"] == []


async def test_server_demo_fill_commit_missing_consistency_metadata_still_succeeds(
    client: AsyncClient,
) -> None:
    operation_id = "test-fill-no-metadata"

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "sourceRange": {"startRow": 170, "endRow": 170, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 170, "endRow": 171, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000170"],
            "targetRowIds": ["srv-000170", "srv-000171"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["warnings"] == []
    assert body["revision"]

async def test_server_demo_fill_commit_stale_revision_returns_409(client: AsyncClient) -> None:
    operation_id = "test-fill-stale-revision-warning"
    await fetch_fill_boundary_body(client, start_row_index=130)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "baseRevision": "definitely-stale",
            "sourceRange": {"startRow": 130, "endRow": 130, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 130, "endRow": 131, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000130"],
            "targetRowIds": ["srv-000130", "srv-000131"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "stale-revision",
        "message": "Fill commit revision is stale",
    }


async def test_server_demo_fill_commit_projection_hash_mismatch_returns_409(client: AsyncClient) -> None:
    operation_id = "test-fill-projection-warning"
    await fetch_fill_boundary_body(client, start_row_index=140)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "projectionHash": "incorrect-hash",
            "sourceRange": {"startRow": 140, "endRow": 140, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 140, "endRow": 141, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000140"],
            "targetRowIds": ["srv-000140", "srv-000141"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "projection-mismatch",
        "message": "Fill commit projection does not match boundary projection",
    }


async def test_server_demo_fill_commit_boundary_token_mismatch_returns_409(client: AsyncClient) -> None:
    operation_id = "test-fill-boundary-warning"
    boundary_body = await fetch_fill_boundary_body(client, start_row_index=150)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "boundaryToken": "not-the-boundary-token",
            "baseRevision": boundary_body["revision"],
            "projectionHash": boundary_body["projectionHash"],
            "sourceRange": {"startRow": 150, "endRow": 150, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 150, "endRow": 151, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000150"],
            "targetRowIds": ["srv-000150", "srv-000151"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "boundary-mismatch",
        "message": "Fill commit boundary token is invalid",
    }


async def test_server_demo_fill_commit_multiple_consistency_mismatches_prioritize_stale_revision(
    client: AsyncClient,
) -> None:
    operation_id = "test-fill-multi-warning"
    await fetch_fill_boundary_body(client, start_row_index=160)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "baseRevision": "stale",
            "projectionHash": "wrong-hash",
            "boundaryToken": "wrong-token",
            "sourceRange": {"startRow": 160, "endRow": 160, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 160, "endRow": 161, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000160"],
            "targetRowIds": ["srv-000160", "srv-000161"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "code": "stale-revision",
        "message": "Fill commit revision is stale",
    }


async def test_server_demo_fill_commit_matching_metadata_allows_fill_commit(
    client: AsyncClient,
) -> None:
    operation_id = "test-fill-matching-metadata"
    boundary_body = await fetch_fill_boundary_body(client, start_row_index=170)
    end_row_index = boundary_body["endRowIndex"]
    assert isinstance(end_row_index, int)
    target_row_ids = [f"srv-{row_index:06d}" for row_index in range(170, end_row_index + 1)]

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "baseRevision": boundary_body["revision"],
            "projectionHash": boundary_body["projectionHash"],
            "boundaryToken": boundary_body["boundaryToken"],
            "sourceRange": {"startRow": 170, "endRow": 170, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 170, "endRow": end_row_index, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000170"],
            "targetRowIds": target_row_ids,
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["warnings"] == []
    assert body["affectedRowCount"] == 1
    assert body["affectedCellCount"] == 1


async def test_server_demo_fill_commit_noop_is_explicit(client: AsyncClient) -> None:
    operation_id = "test-fill-copy-noop"
    before = await pull_row(client, 20)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "revision": "rev-before",
            "sourceRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000020"],
            "targetRowIds": ["srv-000020"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["affectedRowCount"] == 0
    assert body["affectedCellCount"] == 0
    assert body["warnings"] == ["server fill no-op"]
    assert body["invalidation"] is None
    assert (await pull_row(client, 20))["status"] == before["status"]

    operation, events = await fetch_operation_history(operation_id)
    assert operation is None
    assert events == []


async def test_server_demo_fill_commit_copy_multi_row_multi_column(client: AsyncClient) -> None:
    operation_id = "test-fill-copy-multi"

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "revision": "rev-before",
            "sourceRange": {"startRow": 30, "endRow": 31, "startColumn": 0, "endColumn": 1},
            "targetRange": {"startRow": 30, "endRow": 33, "startColumn": 0, "endColumn": 1},
            "sourceRowIds": ["srv-000030", "srv-000031"],
            "targetRowIds": ["srv-000030", "srv-000031", "srv-000032", "srv-000033"],
            "fillColumns": ["segment", "region"],
            "referenceColumns": ["segment", "region"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["affectedRowCount"] == 2
    assert body["affectedCellCount"] == 4
    assert body["warnings"] == []

    row_32 = await pull_row(client, 32)
    row_33 = await pull_row(client, 33)
    assert row_32["segment"] == "Enterprise"
    assert row_32["region"] == "APAC"
    assert row_33["segment"] == "SMB"
    assert row_33["region"] == "LATAM"

    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.operation_type == "fill"
    assert operation.status == "applied"
    assert len(events) == 4
    assert sorted((event.row_id, event.column_key) for event in events) == [
        ("srv-000032", "region"),
        ("srv-000032", "segment"),
        ("srv-000033", "region"),
        ("srv-000033", "segment"),
    ]


async def test_server_demo_fill_commit_ignores_readonly_columns_safely(client: AsyncClient) -> None:
    operation_id = "test-fill-readonly-ignore"
    before = await pull_row(client, 41)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "revision": "rev-before",
            "sourceRange": {"startRow": 40, "endRow": 40, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 40, "endRow": 41, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000040"],
            "targetRowIds": ["srv-000040", "srv-000041"],
            "fillColumns": ["id", "status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] == operation_id
    assert body["affectedRowCount"] == 1
    assert body["affectedCellCount"] == 1
    assert body["warnings"] == ["id: readonly-column", "id: readonly-column"]

    after = await pull_row(client, 41)
    assert after["id"] == before["id"]
    assert after["status"] == "Paused"

    operation, events = await fetch_operation_history(operation_id)
    assert operation is not None
    assert operation.operation_type == "fill"
    assert operation.status == "applied"
    assert len(events) == 1
    assert events[0].column_key == "status"


async def test_server_demo_fill_commit_rejects_explicit_series_mode(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "test-fill-series-rejected",
            "revision": "rev-before",
            "sourceRange": {"startRow": 50, "endRow": 50, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 50, "endRow": 52, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000050"],
            "targetRowIds": ["srv-000050", "srv-000051", "srv-000052"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "series",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "unsupported-fill-mode"
    assert body["message"] == "Series fill is not implemented yet"
