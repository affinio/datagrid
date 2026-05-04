from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.features.server_demo.seed import seed_demo_rows
from app.main import app

pytestmark = pytest.mark.asyncio(loop_scope="session")


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


async def test_server_demo_single_edit_persists(client: AsyncClient) -> None:
    before = await pull_row(client, 10)

    response = await client.post(
        "/api/server-demo/edits",
        json={
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
    assert body["invalidation"] == {
        "kind": "range",
        "range": {"start": 10, "end": 10},
        "reason": "server-demo-edits",
    }

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
    assert body["committedRowIds"] == ["srv-000020", "srv-000021"]
    assert [(entry["rowId"], entry["columnId"]) for entry in body["committed"]] == [
        ("srv-000020", "segment"),
        ("srv-000021", "status"),
        ("srv-000021", "region"),
    ]
    assert body["rejected"] == []
    assert body["invalidation"] == {
        "kind": "range",
        "range": {"start": 20, "end": 21},
        "reason": "server-demo-edits",
    }

    row_20 = await pull_row(client, 20)
    row_21 = await pull_row(client, 21)
    assert row_20["segment"] == "SMB"
    assert row_21["status"] == "Paused"
    assert row_21["region"] == "LATAM"


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
    assert body["committed"] == []
    assert body["committedRowIds"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000030", "columnId": "id", "reason": "readonly-column"},
        {"rowId": "srv-000030", "columnId": "updatedAt", "reason": "readonly-column"},
    ]
    assert body["invalidation"] is None

    row = await pull_row(client, 30)
    assert row["id"] == "srv-000030"


async def test_server_demo_invalid_enum_edit_is_rejected(client: AsyncClient) -> None:
    before = await pull_row(client, 40)

    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000040", "columnId": "status", "value": "Archived"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["committed"] == []
    assert body["rejected"] == [
        {"rowId": "srv-000040", "columnId": "status", "reason": "invalid-enum-value"}
    ]
    assert body["invalidation"] is None

    after = await pull_row(client, 40)
    assert after["status"] == before["status"]
    assert after["updatedAt"] == before["updatedAt"]


async def test_server_demo_value_edit_persists_as_integer(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000050", "columnId": "value", "value": "12345"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["committedRowIds"] == ["srv-000050"]
    assert body["rejected"] == []

    row = await pull_row(client, 50)
    assert row["value"] == 12345


async def test_server_demo_edit_persists_after_repeated_pull(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={"edits": [{"rowId": "srv-000060", "columnId": "name", "value": "Reloaded Account 60"}]},
    )

    assert response.status_code == 200
    assert response.json()["rejected"] == []

    first_pull = await pull_row(client, 60)
    second_pull = await pull_row(client, 60)
    assert first_pull["name"] == "Reloaded Account 60"
    assert second_pull["name"] == "Reloaded Account 60"
