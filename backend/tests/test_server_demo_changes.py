from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.features.server_demo.seed import seed_demo_rows
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


async def test_change_feed_returns_ordered_changes(client: AsyncClient) -> None:
    edit_response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000010",
                    "columnId": "name",
                    "value": "Change Feed Edit",
                }
            ],
        },
    )
    assert edit_response.status_code == 200
    edit_body = edit_response.json()

    fill_response = await client.post(
        "/api/server-demo/fill/commit",
        json={
            "sourceRange": {"startRow": 20, "endRow": 20, "startColumn": 0, "endColumn": 0},
            "targetRange": {"startRow": 20, "endRow": 21, "startColumn": 0, "endColumn": 0},
            "sourceRowIds": ["srv-000020"],
            "targetRowIds": ["srv-000020", "srv-000021"],
            "fillColumns": ["status"],
            "referenceColumns": ["status"],
            "mode": "copy",
            "projection": create_fill_projection_payload(),
        },
    )
    assert fill_response.status_code == 200
    fill_body = fill_response.json()

    response = await client.get("/api/changes", params={"sinceVersion": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["datasetVersion"] == int(fill_body["revision"])
    assert [change["operationId"] for change in body["changes"]] == [
        edit_body["operationId"],
        fill_body["operationId"],
    ]
    assert body["changes"][0]["type"] == "cell"
    assert body["changes"][0]["invalidation"]["type"] == "cell"
    assert body["changes"][0]["rows"] == [
        {
            "id": "srv-000010",
            "index": 10,
            "name": "Change Feed Edit",
            "segment": body["changes"][0]["rows"][0]["segment"],
            "status": body["changes"][0]["rows"][0]["status"],
            "region": body["changes"][0]["rows"][0]["region"],
            "value": 970,
            "updatedAt": body["changes"][0]["rows"][0]["updatedAt"],
        },
    ]
    assert body["changes"][0]["user_id"] is None
    assert body["changes"][0]["session_id"] == "server-demo-session"
    assert body["changes"][1]["type"] == "range"
    assert body["changes"][1]["invalidation"]["type"] == "range"
    assert len(body["changes"][1]["rows"]) == 1
    assert {row["id"] for row in body["changes"][1]["rows"]} == {"srv-000021"}


async def test_change_feed_returns_empty_when_since_version_matches_current(client: AsyncClient) -> None:
    response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000011",
                    "columnId": "status",
                    "value": "Paused",
                }
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()

    changes_response = await client.get("/api/changes", params={"sinceVersion": body["datasetVersion"]})
    assert changes_response.status_code == 200
    assert changes_response.json() == {
        "datasetVersion": body["datasetVersion"],
        "changes": [],
    }


async def test_change_feed_falls_back_to_dataset_invalidation_when_gap_is_too_large(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.core.config.get_settings", lambda: Settings(grid_max_change_feed_gap=1))

    first_response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000012",
                    "columnId": "name",
                    "value": "Gap One",
                }
            ],
        },
    )
    assert first_response.status_code == 200

    second_response = await client.post(
        "/api/server-demo/edits",
        json={
            "edits": [
                {
                    "rowId": "srv-000013",
                    "columnId": "name",
                    "value": "Gap Two",
                }
            ],
        },
    )
    assert second_response.status_code == 200

    response = await client.get("/api/changes", params={"sinceVersion": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["changes"] == [
        {
            "type": "dataset",
            "invalidation": {"type": "dataset", "cells": [], "rows": [], "range": None},
            "operationId": None,
            "user_id": None,
            "session_id": None,
        }
    ]
