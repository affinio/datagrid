from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.features.server_demo.revision import ServerDemoRevisionService
from app.features.server_demo.schemas import (
    ServerDemoFillBoundaryRequest,
    ServerDemoFillCommitRequest,
    ServerDemoFillProjectionSnapshot,
    ServerDemoFillRange,
)
from app.features.server_demo.seed import seed_demo_rows
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.grid.revision import GridRevisionService
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


def build_fill_projection() -> ServerDemoFillProjectionSnapshot:
    return ServerDemoFillProjectionSnapshot.model_validate(create_fill_projection_payload())


def build_fill_range(start_row: int, end_row: int) -> ServerDemoFillRange:
    return ServerDemoFillRange.model_validate(
        {"startRow": start_row, "endRow": end_row, "startColumn": 0, "endColumn": 0}
    )


def build_fill_boundary_request(start_row_index: int) -> ServerDemoFillBoundaryRequest:
    return ServerDemoFillBoundaryRequest.model_validate(
        {
            "direction": "down",
            "baseRange": {"startRow": start_row_index, "endRow": start_row_index, "startColumn": 0, "endColumn": 0},
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "projection": create_fill_projection_payload(),
            "startRowIndex": start_row_index,
            "startColumnIndex": 0,
            "limit": 3,
        }
    )


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


async def test_workspace_revision_counters_are_independent(client: AsyncClient) -> None:
    status_a, body_a = await edit_name(client, row_id="srv-000040", value="Workspace A Rename", workspace_id="workspace-a", base_revision="0")
    assert status_a == 200
    assert body_a["revision"] == "1"

    status_b, body_b = await edit_name(client, row_id="srv-000041", value="Workspace B Rename", workspace_id="workspace-b", base_revision="0")
    assert status_b == 200
    assert body_b["revision"] == "1"

    assert await get_current_revision("workspace-a") == "1"
    assert await get_current_revision("workspace-b") == "1"


async def test_same_workspace_shares_revision(client: AsyncClient) -> None:
    first_status, first_body = await edit_name(
        client,
        row_id="srv-000010",
        value="Workspace Shared First",
        workspace_id="shared-workspace",
        base_revision="0",
    )
    assert first_status == 200
    assert first_body["revision"] == "1"

    second_status, second_body = await edit_name(
        client,
        row_id="srv-000011",
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
    edit_status, edit_body = await edit_name(
        client,
        row_id="srv-000050",
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
            "sourceRowIds": ["srv-000042"],
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
            "sourceRowIds": ["srv-000042"],
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
    edit_status, edit_body = await edit_name(
        client,
        row_id="srv-000060",
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
