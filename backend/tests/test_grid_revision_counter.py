from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.features.server_demo.revision import ServerDemoRevisionService
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


async def get_current_revision() -> str:
    service = ServerDemoRevisionService()
    async with AsyncSessionLocal() as session:
        return await service.get_revision(session)


async def pull_row(client: AsyncClient, row_index: int) -> dict[str, object]:
    response = await client.post(
        "/api/server-demo/pull",
        json={"range": {"startRow": row_index, "endRow": row_index + 1}},
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert len(rows) == 1
    return rows[0]


async def commit_edit(
    client: AsyncClient,
    *,
    row_id: str,
    column_id: str,
    value: object,
    base_revision: str | None = None,
) -> tuple[int, dict[str, object]]:
    payload: dict[str, object] = {
        "edits": [
            {
                "rowId": row_id,
                "columnId": column_id,
                "value": value,
            }
        ]
    }
    if base_revision is not None:
        payload["baseRevision"] = base_revision

    response = await client.post("/api/server-demo/edits", json=payload)
    return response.status_code, response.json()


async def test_grid_revision_service_starts_at_zero_when_missing() -> None:
    assert await get_current_revision() == "0"


async def test_edit_commit_increments_revision(client: AsyncClient) -> None:
    before = await get_current_revision()

    status_code, body = await commit_edit(
        client,
        row_id="srv-000010",
        column_id="name",
        value="Renamed Account 10",
        base_revision=before,
    )

    assert status_code == 200
    assert int(body["revision"]) == int(before) + 1
    assert await get_current_revision() == body["revision"]


async def test_edit_commit_without_base_revision_still_succeeds(client: AsyncClient) -> None:
    before = await get_current_revision()

    status_code, body = await commit_edit(
        client,
        row_id="srv-000011",
        column_id="segment",
        value="Enterprise",
    )

    assert status_code == 200
    assert int(body["revision"]) == int(before) + 1
    assert await get_current_revision() == body["revision"]


async def test_edit_commit_with_stale_base_revision_returns_409(client: AsyncClient) -> None:
    before = await get_current_revision()

    status_code, body = await commit_edit(
        client,
        row_id="srv-000012",
        column_id="status",
        value="Paused",
        base_revision="definitely-stale",
    )

    assert status_code == 409
    assert body["code"] == "stale-revision"
    assert body["message"] == "Edit commit revision is stale"
    assert await get_current_revision() == before


async def test_noop_edit_with_stale_base_revision_returns_409(client: AsyncClient) -> None:
    before = await get_current_revision()
    row = await pull_row(client, 13)

    status_code, body = await commit_edit(
        client,
        row_id="srv-000013",
        column_id="status",
        value=row["status"],
        base_revision="stale",
    )

    assert status_code == 409
    assert body["code"] == "stale-revision"
    assert body["message"] == "Edit commit revision is stale"
    assert await get_current_revision() == before


async def test_fill_commit_increments_revision(client: AsyncClient) -> None:
    before = await get_current_revision()

    response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "operationId": "test-fill-revision-bump",
            "sourceRange": {"startRow": 0, "endRow": 0, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 0, "endRow": 1, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000000"],
            "targetRowIds": ["srv-000000", "srv-000001"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["revision"] != before
    assert int(body["revision"]) == int(before) + 1
    assert await get_current_revision() == body["revision"]


async def test_noop_edit_does_not_increment_revision(client: AsyncClient) -> None:
    before = await get_current_revision()
    row = await pull_row(client, 10)

    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000010",
                    "columnId": "status",
                    "value": row["status"],
                }
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["revision"] == before
    assert await get_current_revision() == before


async def test_revision_bump_rolls_back_with_transaction() -> None:
    service = GridRevisionService(SERVER_DEMO_TABLE)

    async with AsyncSessionLocal() as session:
        before = await service.get_revision(session)

    with pytest.raises(RuntimeError):
        async with AsyncSessionLocal() as session:
            async with session.begin():
                bumped = await service.bump_revision(session)
                assert int(bumped) == int(before) + 1
                raise RuntimeError("force rollback")

    async with AsyncSessionLocal() as session:
        after = await service.get_revision(session)

    assert after == before


async def test_undo_and_redo_increment_revision(client: AsyncClient) -> None:
    start_revision = await get_current_revision()

    edit_response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000020",
                    "columnId": "segment",
                    "value": "SMB",
                }
            ]
        },
    )
    assert edit_response.status_code == 200
    edit_body = edit_response.json()
    edit_revision = edit_body["revision"]
    assert int(edit_revision) == int(start_revision) + 1

    undo_response = await client.post(f"/api/server-demo/operations/{edit_body['operationId']}/undo")
    assert undo_response.status_code == 200
    undo_body = undo_response.json()
    assert int(undo_body["revision"]) == int(edit_revision) + 1

    redo_response = await client.post(f"/api/server-demo/operations/{edit_body['operationId']}/redo")
    assert redo_response.status_code == 200
    redo_body = redo_response.json()
    assert int(redo_body["revision"]) == int(undo_body["revision"]) + 1


async def test_second_edit_with_stale_base_revision_fails(client: AsyncClient) -> None:
    before = await get_current_revision()

    first_status, first_body = await commit_edit(
        client,
        row_id="srv-000030",
        column_id="name",
        value="First Stale Guard",
        base_revision=before,
    )
    assert first_status == 200
    assert int(first_body["revision"]) == int(before) + 1

    second_status, second_body = await commit_edit(
        client,
        row_id="srv-000031",
        column_id="name",
        value="Second Stale Guard",
        base_revision=before,
    )

    assert second_status == 409
    assert second_body["code"] == "stale-revision"
    assert second_body["message"] == "Edit commit revision is stale"


async def test_concurrent_bumps_produce_strictly_increasing_values() -> None:
    service = GridRevisionService(SERVER_DEMO_TABLE)
    start = asyncio.Event()

    async def bump() -> str:
        async with AsyncSessionLocal() as session:
            await start.wait()
            async with session.begin():
                return await service.bump_revision(session)

    first = asyncio.create_task(bump())
    second = asyncio.create_task(bump())
    start.set()
    values = [int(value) for value in await asyncio.gather(first, second)]

    assert sorted(values) == [1, 2]
