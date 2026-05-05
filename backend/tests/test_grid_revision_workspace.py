from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

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
) -> tuple[int, dict[str, object]]:
    payload: dict[str, object] = {"edits": [{"rowId": row_id, "columnId": "name", "value": value}]}
    if base_revision is not None:
        payload["baseRevision"] = base_revision
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
    assert wrong_workspace_undo.status_code == 200
    assert wrong_workspace_undo.json()["rejected"] == [
        {"rowId": "ws-a-000000", "columnId": "name", "reason": "row-not-found"}
    ]
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
    assert wrong_workspace_redo.status_code == 200
    assert wrong_workspace_redo.json()["rejected"] == [
        {"rowId": "ws-a-000000", "columnId": "name", "reason": "row-not-found"}
    ]
