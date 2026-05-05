from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.features.server_demo.models import ServerDemoCellEvent, ServerDemoOperation
from app.features.server_demo.revision import ServerDemoRevisionService
from app.features.server_demo.seed import insert_demo_rows, seed_demo_rows
from app.infrastructure.db.database import AsyncSessionLocal
from app.main import app

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(scope="function", autouse=True)
async def seed_server_demo_rows() -> AsyncIterator[None]:
    await seed_demo_rows()
    yield


@pytest_asyncio.fixture(loop_scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


def workspace_headers(workspace_id: str | None) -> dict[str, str]:
    return {"X-Workspace-Id": workspace_id} if workspace_id is not None else {}


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


async def get_current_revision(workspace_id: str | None) -> str:
    service = ServerDemoRevisionService(workspace_id)
    async with AsyncSessionLocal() as session:
        return await service.get_revision(session)


async def edit_name(
    client: AsyncClient,
    *,
    row_id: str,
    value: str,
    workspace_id: str | None = None,
    base_revision: str | None = None,
    operation_id: str | None = None,
) -> tuple[int, dict[str, object]]:
    payload: dict[str, object] = {"edits": [{"rowId": row_id, "columnId": "name", "value": value}]}
    if base_revision is not None:
        payload["baseRevision"] = base_revision
    if operation_id is not None:
        payload["operationId"] = operation_id
    response = await client.post("/api/server-demo/edits", json=payload, headers=workspace_headers(workspace_id))
    return response.status_code, response.json()


async def insert_workspace_rows(
    *,
    workspace_id: str,
    id_prefix: str,
    row_count: int,
    row_index_start: int = 0,
) -> None:
    await insert_demo_rows(
        workspace_id=workspace_id,
        id_prefix=id_prefix,
        row_count=row_count,
        row_index_start=row_index_start,
    )


async def pull_workspace_rows(client: AsyncClient, workspace_id: str | None, *, start: int, end: int) -> dict[str, object]:
    response = await client.post(
        "/api/server-demo/pull",
        json={"range": {"startRow": start, "endRow": end}},
        headers=workspace_headers(workspace_id),
    )
    assert response.status_code == 200
    return response.json()


async def fetch_operation_history(
    operation_id: str,
    workspace_id: str | None,
) -> tuple[ServerDemoOperation | None, list[ServerDemoCellEvent]]:
    async with AsyncSessionLocal() as session:
        operation_stmt = select(ServerDemoOperation).where(ServerDemoOperation.operation_id == operation_id)
        if workspace_id is None:
            operation_stmt = operation_stmt.where(ServerDemoOperation.workspace_id.is_(None))
        else:
            operation_stmt = operation_stmt.where(ServerDemoOperation.workspace_id == workspace_id)
        operation = await session.scalar(operation_stmt)

        events_stmt = select(ServerDemoCellEvent).where(ServerDemoCellEvent.operation_id == operation_id)
        if workspace_id is None:
            events_stmt = events_stmt.where(ServerDemoCellEvent.workspace_id.is_(None))
        else:
            events_stmt = events_stmt.where(ServerDemoCellEvent.workspace_id == workspace_id)
        events = (await session.scalars(events_stmt.order_by(ServerDemoCellEvent.created_at.asc(), ServerDemoCellEvent.event_id.asc()))).all()

    return operation, list(events)


async def test_workspace_revision_counters_are_independent(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=40)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=41)

    status_a, body_a = await edit_name(
        client,
        row_id="ws-a-000040",
        value="Workspace A Rename",
        workspace_id="workspace-a",
        base_revision="0",
    )
    assert status_a == 200
    assert body_a["revision"] == "1"

    status_b, body_b = await edit_name(
        client,
        row_id="ws-b-000041",
        value="Workspace B Rename",
        workspace_id="workspace-b",
        base_revision="0",
    )
    assert status_b == 200
    assert body_b["revision"] == "1"

    assert await get_current_revision("workspace-a") == "1"
    assert await get_current_revision("workspace-b") == "1"


async def test_same_workspace_shares_revision(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="shared-workspace", id_prefix="shared", row_count=2, row_index_start=10)

    first_status, first_body = await edit_name(
        client,
        row_id="shared-000010",
        value="Workspace Shared First",
        workspace_id="shared-workspace",
        base_revision="0",
    )
    assert first_status == 200
    assert first_body["revision"] == "1"

    second_status, second_body = await edit_name(
        client,
        row_id="shared-000011",
        value="Workspace Shared Second",
        workspace_id="shared-workspace",
        base_revision="1",
    )
    assert second_status == 200
    assert second_body["revision"] == "2"

    assert await get_current_revision("shared-workspace") == "2"


async def test_default_workspace_behaves_like_legacy(client: AsyncClient) -> None:
    first_status, first_body = await edit_name(client, row_id="srv-000020", value="Legacy First", base_revision="0")
    assert first_status == 200
    assert first_body["revision"] == "1"

    second_status, second_body = await edit_name(client, row_id="srv-000021", value="Legacy Second", base_revision="1")
    assert second_status == 200
    assert second_body["revision"] == "2"

    assert await get_current_revision(None) == "2"


async def test_fill_stale_revision_respects_workspace_scope(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=2, row_index_start=42)

    edit_status, edit_body = await edit_name(
        client,
        row_id="ws-a-000042",
        value="Workspace A Seed",
        workspace_id="workspace-a",
        base_revision="0",
    )
    assert edit_status == 200
    assert edit_body["revision"] == "1"

    boundary_response = await client.post(
        "/api/server-demo/fill-boundary",
        json={
            "direction": "down",
            "baseRange": {"startRow": 42, "endRow": 42, "startColumn": 0, "endColumn": 0},
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "projection": create_fill_projection_payload(),
            "startRowIndex": 42,
            "startColumnIndex": 0,
            "limit": 3,
        },
        headers=workspace_headers("workspace-a"),
    )
    assert boundary_response.status_code == 200
    boundary = boundary_response.json()

    fill_response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "workspace-a-fill",
            "baseRevision": boundary["revision"],
            "projectionHash": boundary["projectionHash"],
            "boundaryToken": boundary["boundaryToken"],
            "sourceRange": {"startRow": 42, "endRow": 42, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": boundary["endRowIndex"], "endRow": boundary["endRowIndex"], "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["ws-a-000042"],
            "targetRowIds": [boundary["endRowId"]],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
        headers=workspace_headers("workspace-a"),
    )
    assert fill_response.status_code == 200

    stale_response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "workspace-b-stale-fill",
            "baseRevision": "1",
            "projectionHash": boundary["projectionHash"],
            "boundaryToken": boundary["boundaryToken"],
            "sourceRange": {"startRow": 42, "endRow": 42, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": boundary["endRowIndex"], "endRow": boundary["endRowIndex"], "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["ws-a-000042"],
            "targetRowIds": [boundary["endRowId"]],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
        headers=workspace_headers("workspace-b"),
    )
    assert stale_response.status_code == 409
    assert stale_response.json()["code"] == "stale-revision"


async def test_undo_redo_respects_workspace_scope(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=60)

    edit_status, edit_body = await edit_name(
        client,
        row_id="ws-a-000060",
        value="Undo Redo Workspace",
        workspace_id="workspace-a",
        base_revision="0",
    )
    assert edit_status == 200
    assert edit_body["revision"] == "1"

    undo_response = await client.post(
        f"/api/server-demo/operations/{edit_body['operationId']}/undo",
        headers=workspace_headers("workspace-a"),
    )
    assert undo_response.status_code == 200
    assert undo_response.json()["revision"] == "2"

    redo_response = await client.post(
        f"/api/server-demo/operations/{edit_body['operationId']}/redo",
        headers=workspace_headers("workspace-a"),
    )
    assert redo_response.status_code == 200
    assert redo_response.json()["revision"] == "3"

    assert await get_current_revision("workspace-a") == "3"


async def test_workspace_row_isolation_and_revision_scope_agree(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=2, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=2, row_index_start=2)

    workspace_a_pull = await pull_workspace_rows(client, "workspace-a", start=0, end=10)
    workspace_b_pull = await pull_workspace_rows(client, "workspace-b", start=0, end=10)
    legacy_pull = await pull_workspace_rows(client, None, start=0, end=3)

    assert workspace_a_pull["total"] == 2
    assert [row["id"] for row in workspace_a_pull["rows"]] == ["ws-a-000000", "ws-a-000001"]
    assert workspace_b_pull["total"] == 2
    assert [row["id"] for row in workspace_b_pull["rows"]] == ["ws-b-000002", "ws-b-000003"]
    assert legacy_pull["total"] == 100_000
    assert legacy_pull["rows"][0]["id"] == "srv-000000"

    edit_status, edit_body = await edit_name(
        client,
        row_id="ws-a-000000",
        value="Workspace A Rename",
        workspace_id="workspace-a",
        base_revision="0",
    )
    assert edit_status == 200
    assert edit_body["revision"] == "1"
    assert await get_current_revision("workspace-a") == "1"
    assert await get_current_revision("workspace-b") == "0"

    refreshed_workspace_a_pull = await pull_workspace_rows(client, "workspace-a", start=0, end=10)
    refreshed_workspace_b_pull = await pull_workspace_rows(client, "workspace-b", start=0, end=10)
    assert refreshed_workspace_a_pull["rows"][0]["name"] == "Workspace A Rename"
    assert refreshed_workspace_b_pull["rows"][0]["name"] != "Workspace A Rename"


async def test_workspace_a_pull_does_not_see_workspace_b_rows(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=1)

    body = await pull_workspace_rows(client, "workspace-a", start=0, end=10)

    assert body["total"] == 1
    assert [row["id"] for row in body["rows"]] == ["ws-a-000000"]


async def test_workspace_a_edit_cannot_edit_workspace_b_row(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=1)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "ws-b-000001", "columnId": "name", "value": "Should Not Apply"}]},
        headers=workspace_headers("workspace-a"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["operationId"] is None
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "ws-b-000001", "columnId": "name", "reason": "row-not-found"}
    ]


async def test_workspace_a_histogram_counts_only_workspace_a_rows(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=2, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=2, row_index_start=2)

    response = await client.post(
        "/api/server-demo/histogram",
        json={"columnId": "region", "filterModel": None},
        headers=workspace_headers("workspace-a"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["columnId"] == "region"
    assert sorted((entry["value"], entry["count"]) for entry in body["entries"]) == [
        ("AMER", 1),
        ("EMEA", 1),
    ]


async def test_workspace_a_fill_cannot_use_workspace_b_rows(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=2, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=2, row_index_start=2)

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "workspace-a-fill-guard",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 1, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["ws-b-000002"],
            "targetRowIds": ["ws-a-000000", "ws-a-000001"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
        headers=workspace_headers("workspace-a"),
    )

    assert response.status_code == 404
    assert response.json()["code"] == "row-not-found"


async def test_workspace_a_undo_redo_respects_row_scope(client: AsyncClient) -> None:
    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=1)

    edit_status, edit_body = await edit_name(
        client,
        row_id="ws-a-000000",
        value="Scoped Undo Redo",
        workspace_id="workspace-a",
        base_revision="0",
    )
    assert edit_status == 200
    operation_id = edit_body["operationId"]

    wrong_workspace_undo = await client.post(
        f"/api/server-demo/operations/{operation_id}/undo",
        headers=workspace_headers("workspace-b"),
    )
    assert wrong_workspace_undo.status_code == 404
    assert wrong_workspace_undo.json()["code"] == "operation-not-found"
    assert (await pull_workspace_rows(client, "workspace-a", start=0, end=1))["rows"][0]["name"] == "Scoped Undo Redo"

    correct_workspace_undo = await client.post(
        f"/api/server-demo/operations/{operation_id}/undo",
        headers=workspace_headers("workspace-a"),
    )
    assert correct_workspace_undo.status_code == 200
    assert (await pull_workspace_rows(client, "workspace-a", start=0, end=1))["rows"][0]["name"] == "Account 00000"

    wrong_workspace_redo = await client.post(
        f"/api/server-demo/operations/{operation_id}/redo",
        headers=workspace_headers("workspace-b"),
    )
    assert wrong_workspace_redo.status_code == 404
    assert wrong_workspace_redo.json()["code"] == "operation-not-found"


async def test_workspace_a_fill_history_scoped_correctly(client: AsyncClient) -> None:
    operation_id = "shared-fill-history"

    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=2, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=2, row_index_start=0)

    response_a = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 1, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["ws-a-000000"],
            "targetRowIds": ["ws-a-000000", "ws-a-000001"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
        headers=workspace_headers("workspace-a"),
    )
    assert response_a.status_code == 200

    response_b = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": operation_id,
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 1, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["ws-b-000000"],
            "targetRowIds": ["ws-b-000000", "ws-b-000001"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
        headers=workspace_headers("workspace-b"),
    )
    assert response_b.status_code == 200

    operation_a, events_a = await fetch_operation_history(operation_id, "workspace-a")
    operation_b, events_b = await fetch_operation_history(operation_id, "workspace-b")

    assert operation_a is not None
    assert operation_a.workspace_id == "workspace-a"
    assert operation_a.operation_type == "fill"
    assert [event.workspace_id for event in events_a] == ["workspace-a"]
    assert [event.row_id for event in events_a] == ["ws-a-000001"]

    assert operation_b is not None
    assert operation_b.workspace_id == "workspace-b"
    assert operation_b.operation_type == "fill"
    assert [event.workspace_id for event in events_b] == ["workspace-b"]
    assert [event.row_id for event in events_b] == ["ws-b-000001"]


async def test_workspace_a_edit_history_scoped_correctly(client: AsyncClient) -> None:
    operation_id = "shared-edit-history"

    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=0)

    edit_status_a, edit_body_a = await edit_name(
        client,
        row_id="ws-a-000000",
        value="Workspace A Edit",
        workspace_id="workspace-a",
        base_revision="0",
        operation_id=operation_id,
    )
    assert edit_status_a == 200

    edit_status_b, edit_body_b = await edit_name(
        client,
        row_id="ws-b-000000",
        value="Workspace B Edit",
        workspace_id="workspace-b",
        base_revision="0",
        operation_id=operation_id,
    )
    assert edit_status_b == 200

    operation_a, events_a = await fetch_operation_history(operation_id, "workspace-a")
    operation_b, events_b = await fetch_operation_history(operation_id, "workspace-b")

    assert operation_a is not None
    assert operation_a.workspace_id == "workspace-a"
    assert operation_a.operation_type == "edit"
    assert [event.workspace_id for event in events_a] == ["workspace-a"]
    assert [event.row_id for event in events_a] == ["ws-a-000000"]
    assert events_a[0].after_value == "Workspace A Edit"

    assert operation_b is not None
    assert operation_b.workspace_id == "workspace-b"
    assert operation_b.operation_type == "edit"
    assert [event.workspace_id for event in events_b] == ["workspace-b"]
    assert [event.row_id for event in events_b] == ["ws-b-000000"]
    assert events_b[0].after_value == "Workspace B Edit"

    assert edit_body_a["operationId"] == operation_id
    assert edit_body_b["operationId"] == operation_id


async def test_same_operation_id_in_different_workspaces_does_not_conflict(client: AsyncClient) -> None:
    operation_id = "shared-operation-id"

    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=1)

    edit_status_a, _ = await edit_name(
        client,
        row_id="ws-a-000000",
        value="Workspace A Shared Op",
        workspace_id="workspace-a",
        base_revision="0",
        operation_id=operation_id,
    )
    edit_status_b, _ = await edit_name(
        client,
        row_id="ws-b-000001",
        value="Workspace B Shared Op",
        workspace_id="workspace-b",
        base_revision="0",
        operation_id=operation_id,
    )

    assert edit_status_a == 200
    assert edit_status_b == 200

    operation_a, events_a = await fetch_operation_history(operation_id, "workspace-a")
    operation_b, events_b = await fetch_operation_history(operation_id, "workspace-b")

    assert operation_a is not None
    assert operation_b is not None
    assert operation_a.workspace_id == "workspace-a"
    assert operation_b.workspace_id == "workspace-b"
    assert [event.row_id for event in events_a] == ["ws-a-000000"]
    assert [event.row_id for event in events_b] == ["ws-b-000001"]


async def test_legacy_null_workspace_still_works(client: AsyncClient) -> None:
    operation_id = "legacy-null-workspace"

    edit_status, edit_body = await edit_name(
        client,
        row_id="srv-000010",
        value="Legacy Null Workspace",
        operation_id=operation_id,
        base_revision="0",
    )
    assert edit_status == 200

    operation, events = await fetch_operation_history(operation_id, None)
    assert operation is not None
    assert operation.workspace_id is None
    assert operation.operation_type == "edit"
    assert len(events) == 1
    assert events[0].workspace_id is None
    assert events[0].row_id == "srv-000010"

    undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo")
    assert undo_response.status_code == 200
    assert (await pull_workspace_rows(client, None, start=10, end=11))["rows"][0]["name"] == "Account 00010"

    assert edit_body["operationId"] == operation_id


async def test_row_and_operation_scope_consistency_no_cross_workspace_replay(
    client: AsyncClient,
) -> None:
    operation_id = "shared-replay-operation"

    await insert_workspace_rows(workspace_id="workspace-a", id_prefix="ws-a", row_count=1, row_index_start=0)
    await insert_workspace_rows(workspace_id="workspace-b", id_prefix="ws-b", row_count=1, row_index_start=0)

    edit_status_a, _ = await edit_name(
        client,
        row_id="ws-a-000000",
        value="Workspace A Replay",
        workspace_id="workspace-a",
        base_revision="0",
        operation_id=operation_id,
    )
    edit_status_b, _ = await edit_name(
        client,
        row_id="ws-b-000000",
        value="Workspace B Replay",
        workspace_id="workspace-b",
        base_revision="0",
        operation_id=operation_id,
    )
    assert edit_status_a == 200
    assert edit_status_b == 200

    undo_a = await client.post(
        f"/api/server-demo/operations/{operation_id}/undo",
        headers=workspace_headers("workspace-a"),
    )
    assert undo_a.status_code == 200
    assert (await pull_workspace_rows(client, "workspace-a", start=0, end=1))["rows"][0]["name"] == "Account 00000"
    assert (await pull_workspace_rows(client, "workspace-b", start=0, end=1))["rows"][0]["name"] == "Workspace B Replay"

    undo_b = await client.post(
        f"/api/server-demo/operations/{operation_id}/undo",
        headers=workspace_headers("workspace-b"),
    )
    assert undo_b.status_code == 200
    assert (await pull_workspace_rows(client, "workspace-b", start=0, end=1))["rows"][0]["name"] == "Account 00000"
