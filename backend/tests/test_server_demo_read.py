from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.features.server_demo.seed import seed_demo_rows
from app.main import app

pytestmark = pytest.mark.asyncio(loop_scope="session")

EXPECTED_SERVER_DEMO_REVISION = "2025-01-02T03:46:39+00:00"

@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def seed_server_demo_rows() -> AsyncIterator[None]:
    await seed_demo_rows()
    yield


@pytest_asyncio.fixture(loop_scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


async def test_server_demo_health(client: AsyncClient) -> None:
    response = await client.get("/api/server-demo/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_server_demo_pull_basic_range(client: AsyncClient) -> None:
    response = await client.post("/api/server-demo/pull", json={"range": {"startRow": 0, "endRow": 50}})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 100_000
    assert len(body["rows"]) == 50


async def test_server_demo_pull_maps_row_shape(client: AsyncClient) -> None:
    response = await client.post("/api/server-demo/pull", json={"range": {"startRow": 0, "endRow": 1}})

    assert response.status_code == 200
    row = response.json()["rows"][0]
    assert row == {
        "id": "srv-000000",
        "index": 0,
        "name": "Account 00000",
        "segment": "Core",
        "status": "Active",
        "region": "AMER",
        "value": 0,
        "updatedAt": "2025-01-01T00:00:00Z",
    }


async def test_server_demo_pull_region_equality_filter(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "filterModel": {"region": {"filterType": "text", "type": "equals", "filter": "EMEA"}},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 25_000
    assert body["revision"] == EXPECTED_SERVER_DEMO_REVISION
    assert all(row["region"] == "EMEA" for row in body["rows"])


async def test_server_demo_pull_region_and_status_filter(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "filterModel": {
                "region": {"filterType": "text", "type": "equals", "filter": "EMEA"},
                "status": {"filterType": "text", "type": "equals", "filter": "Closed"},
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] > 0
    assert body["revision"] == EXPECTED_SERVER_DEMO_REVISION
    assert all(row["region"] == "EMEA" and row["status"] == "Closed" for row in body["rows"])


async def test_server_demo_pull_name_contains_filter(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 20},
            "filterModel": {"name": {"filterType": "text", "type": "contains", "filter": "Account 0001"}},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 10
    assert body["revision"] == EXPECTED_SERVER_DEMO_REVISION
    assert all("Account 0001" in row["name"] for row in body["rows"])


async def test_server_demo_pull_no_match_returns_stable_revision(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "filterModel": {
                "region": {"filterType": "text", "type": "equals", "filter": "NOPE"},
                "status": {"filterType": "text", "type": "equals", "filter": "NOPE"},
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == []
    assert body["total"] == 0
    assert body["revision"] == EXPECTED_SERVER_DEMO_REVISION


async def test_server_demo_pull_value_min_max_filter(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "filterModel": {"value": {"min": 1000, "max": 2000}},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1_001
    assert all(1000 <= row["value"] <= 2000 for row in body["rows"])


async def test_server_demo_pull_value_desc_sort(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "sortModel": [{"colId": "value", "sort": "desc"}],
        },
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert rows[0]["value"] == 99_999
    assert rows[1]["value"] == 99_998
    assert rows[0]["value"] > rows[-1]["value"]


async def test_server_demo_pull_ignores_unknown_sort_column(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "sortModel": [{"colId": "does_not_exist", "sort": "asc"}],
        },
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert len(rows) == 50
    assert rows[0]["index"] == 0
    assert rows[1]["index"] == 1


async def test_server_demo_region_histogram(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/histogram",
        json={"columnId": "region", "filterModel": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["columnId"] == "region"
    assert len(body["entries"]) == 4
    assert {entry["value"] for entry in body["entries"]} == {"AMER", "APAC", "EMEA", "LATAM"}
    assert all(entry["count"] == 25_000 for entry in body["entries"])


async def test_server_demo_value_histogram_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/histogram",
        json={"columnId": "value", "filterModel": None},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "unsupported_histogram_column",
        "message": "Value histograms are not implemented yet",
    }
