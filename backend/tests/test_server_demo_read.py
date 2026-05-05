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


async def test_server_demo_pull_invalid_sort_direction_falls_back_to_index(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 5},
            "sortModel": [{"colId": "value", "sort": "sideways"}],
        },
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert rows[0]["index"] == 0
    assert rows[1]["index"] == 1


async def test_server_demo_pull_updated_at_sort_aliases(client: AsyncClient) -> None:
    response_alias = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 5},
            "sortModel": [{"colId": "updatedAt", "sort": "desc"}],
        },
    )
    assert response_alias.status_code == 200
    rows_alias = response_alias.json()["rows"]
    assert rows_alias[0]["index"] == 99_999
    assert rows_alias[0]["updatedAt"] >= rows_alias[1]["updatedAt"]

    response_snake = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 5},
            "sortModel": [{"colId": "updated_at", "sort": "desc"}],
        },
    )
    assert response_snake.status_code == 200
    rows_snake = response_snake.json()["rows"]
    assert rows_snake[0]["index"] == 99_999
    assert rows_snake[0]["updatedAt"] >= rows_snake[1]["updatedAt"]


async def test_server_demo_pull_segment_multi_value_filter(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 50},
            "filterModel": {"segment": {"values": ["Core", "SMB"]}},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 50_000
    assert all(row["segment"] in {"Core", "SMB"} for row in body["rows"])


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


async def test_server_demo_region_histogram_respects_filter_model(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/histogram",
        json={
            "columnId": "region",
            "filterModel": {"status": {"filterType": "text", "type": "equals", "filter": "Active"}},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["columnId"] == "region"
    assert len(body["entries"]) == 4
    assert sum(entry["count"] for entry in body["entries"]) == 33_334


@pytest.mark.parametrize("column_id", ["segment", "status"])
async def test_server_demo_enum_histograms(client: AsyncClient, column_id: str) -> None:
    response = await client.post(
        "/api/server-demo/histogram",
        json={"columnId": column_id, "filterModel": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["columnId"] == column_id
    assert body["entries"]
    assert all(entry["count"] > 0 for entry in body["entries"])


async def test_server_demo_invalid_numeric_filter_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/pull",
        json={
            "range": {"startRow": 0, "endRow": 10},
            "filterModel": {"value": {"min": "not-a-number"}},
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "invalid_filter",
        "message": "Numeric filters must contain integer values",
    }


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
