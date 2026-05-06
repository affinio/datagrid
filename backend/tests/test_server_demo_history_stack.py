from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.features.server_demo.models import ServerDemoOperation
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


def workspace_headers(workspace_id: str) -> dict[str, str]:
    return {"X-Workspace-Id": workspace_id}


def server_demo_history_scope(
    *,
    workspace_id: str,
    user_id: str | None = "history-user-a",
    session_id: str | None = "history-session-a",
) -> dict[str, str | None]:
    return {
        "workspace_id": workspace_id,
        "table_id": "server_demo",
        "user_id": user_id,
        "session_id": session_id,
    }


async def insert_workspace_rows(*, workspace_id: str, id_prefix: str, row_count: int = 1) -> None:
    await insert_demo_rows(workspace_id=workspace_id, id_prefix=id_prefix, row_count=row_count)


async def commit_name(
    client: AsyncClient,
    *,
    workspace_id: str,
    row_id: str,
    value: str,
    operation_id: str,
    user_id: str = "history-user-a",
    session_id: str = "history-session-a",
) -> dict[str, object]:
    response = await client.post(
        "/api/server-demo/edits",
        headers=workspace_headers(workspace_id),
        json={
            "operationId": operation_id,
            **server_demo_history_scope(
                workspace_id=workspace_id,
                user_id=user_id,
                session_id=session_id,
            ),
            "edits": [{"rowId": row_id, "columnId": "name", "value": value}],
        },
    )
    assert response.status_code == 200
    return response.json()


async def stack_action(
    client: AsyncClient,
    action: str,
    *,
    workspace_id: str,
    user_id: str = "history-user-a",
    session_id: str = "history-session-a",
) -> tuple[int, dict[str, object]]:
    response = await client.post(
        f"/api/history/{action}",
        json=server_demo_history_scope(workspace_id=workspace_id, user_id=user_id, session_id=session_id),
    )
    return response.status_code, response.json()


async def status_action(
    client: AsyncClient,
    *,
    workspace_id: str,
    user_id: str = "history-user-a",
    session_id: str = "history-session-a",
) -> tuple[int, dict[str, object]]:
    response = await client.post(
        "/api/history/status",
        json=server_demo_history_scope(workspace_id=workspace_id, user_id=user_id, session_id=session_id),
    )
    return response.status_code, response.json()


async def pull_name(client: AsyncClient, *, workspace_id: str, row_index: int = 0) -> str:
    response = await client.post(
        "/api/server-demo/pull",
        headers=workspace_headers(workspace_id),
        json={"range": {"startRow": row_index, "endRow": row_index + 1}},
    )
    assert response.status_code == 200
    rows = response.json()["rows"]
    assert len(rows) == 1
    return rows[0]["name"]


async def fetch_operation(workspace_id: str, operation_id: str) -> ServerDemoOperation:
    async with AsyncSessionLocal() as session:
        operation = await session.scalar(
            select(ServerDemoOperation).where(
                ServerDemoOperation.workspace_id == workspace_id,
                ServerDemoOperation.table_id == "server_demo",
                ServerDemoOperation.operation_id == operation_id,
            )
        )
    assert operation is not None
    return operation


async def test_stack_undo_without_operation_id_uses_latest_operation(client: AsyncClient) -> None:
    workspace_id = "history-stack-latest-undo"
    row_id = "hist-latest-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-latest")

    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="First", operation_id="latest-undo-1")
    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="Second", operation_id="latest-undo-2")

    status_code, body = await stack_action(client, "undo", workspace_id=workspace_id)

    assert status_code == 200
    assert body["operationId"] == "latest-undo-2"
    assert body["action"] == "undo"
    assert body["canUndo"] is True
    assert body["canRedo"] is True
    assert body["affectedRows"] == 1
    assert body["affectedCells"] == 1
    assert await pull_name(client, workspace_id=workspace_id) == "First"


async def test_history_status_reports_empty_stack(client: AsyncClient) -> None:
    workspace_id = "history-status-empty"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-status-empty")

    status_code, body = await status_action(client, workspace_id=workspace_id)

    assert status_code == 200
    assert body == {
        "workspace_id": workspace_id,
        "table_id": "server_demo",
        "user_id": "history-user-a",
        "session_id": "history-session-a",
        "canUndo": False,
        "canRedo": False,
        "latestUndoOperationId": None,
        "latestRedoOperationId": None,
    }


async def test_history_status_tracks_commit_undo_redo_state(client: AsyncClient) -> None:
    workspace_id = "history-status-flow"
    row_id = "hist-flow-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-flow")

    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="First", operation_id="flow-1")
    operation = await fetch_operation(workspace_id, "flow-1")
    assert operation.workspace_id == workspace_id
    assert operation.table_id == "server_demo"
    assert operation.user_id == "history-user-a"
    assert operation.session_id == "history-session-a"

    commit_status_code, commit_status = await status_action(client, workspace_id=workspace_id)
    assert commit_status_code == 200
    assert commit_status["canUndo"] is True
    assert commit_status["canRedo"] is False
    assert commit_status["latestUndoOperationId"] == "flow-1"
    assert commit_status["latestRedoOperationId"] is None

    undo_status_code, undo_status = await stack_action(client, "undo", workspace_id=workspace_id)
    assert undo_status_code == 200
    assert undo_status["canUndo"] is False
    assert undo_status["canRedo"] is True

    post_undo_status_code, post_undo_status = await status_action(client, workspace_id=workspace_id)
    assert post_undo_status_code == 200
    assert post_undo_status["canUndo"] is False
    assert post_undo_status["canRedo"] is True
    assert post_undo_status["latestUndoOperationId"] is None
    assert post_undo_status["latestRedoOperationId"] == "flow-1"

    redo_status_code, redo_status = await stack_action(client, "redo", workspace_id=workspace_id)
    assert redo_status_code == 200
    assert redo_status["canUndo"] is True
    assert redo_status["canRedo"] is False

    post_redo_status_code, post_redo_status = await status_action(client, workspace_id=workspace_id)
    assert post_redo_status_code == 200
    assert post_redo_status["canUndo"] is True
    assert post_redo_status["canRedo"] is False
    assert post_redo_status["latestUndoOperationId"] == "flow-1"
    assert post_redo_status["latestRedoOperationId"] is None


async def test_stack_undo_replays_cell_events_when_commit_and_request_scopes_differ(
    client: AsyncClient,
) -> None:
    request_workspace_id = "history-stack-request-scope"
    header_workspace_id = "history-stack-header-scope"
    row_id = "hist-mismatch-000000"
    operation_id = "scope-mismatch-1"
    await insert_workspace_rows(workspace_id=header_workspace_id, id_prefix="hist-mismatch")

    response = await client.post(
        "/api/server-demo/edits",
        headers=workspace_headers(header_workspace_id),
        json={
            "operationId": operation_id,
            **server_demo_history_scope(workspace_id=request_workspace_id),
            "edits": [{"rowId": row_id, "columnId": "name", "value": "Scoped Mismatch"}],
        },
    )

    assert response.status_code == 200

    status_code, body = await status_action(client, workspace_id=request_workspace_id)
    assert status_code == 200
    assert body["canUndo"] is True
    assert body["latestUndoOperationId"] == operation_id

    undo_status, undo_body = await stack_action(client, "undo", workspace_id=request_workspace_id)
    assert undo_status == 200
    assert undo_body["operationId"] == operation_id
    assert await pull_name(client, workspace_id=header_workspace_id) == "Account 00000"


async def test_history_status_isolated_by_user_and_session_scope(client: AsyncClient) -> None:
    workspace_id = "history-status-scope"
    row_id = "hist-scope-status-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-scope-status")

    await commit_name(
        client,
        workspace_id=workspace_id,
        row_id=row_id,
        value="Scoped",
        operation_id="scope-status-a",
        user_id="history-user-a",
        session_id="history-session-a",
    )

    other_status_code, other_status = await status_action(
        client,
        workspace_id=workspace_id,
        user_id="history-user-b",
        session_id="history-session-b",
    )

    assert other_status_code == 200
    assert other_status["canUndo"] is False
    assert other_status["canRedo"] is False
    assert other_status["latestUndoOperationId"] is None
    assert other_status["latestRedoOperationId"] is None


async def test_stack_redo_without_operation_id_redoes_latest_undone_operation(client: AsyncClient) -> None:
    workspace_id = "history-stack-redo"
    row_id = "hist-redo-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-redo")

    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="First", operation_id="redo-1")
    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="Second", operation_id="redo-2")
    undo_status, _ = await stack_action(client, "undo", workspace_id=workspace_id)
    assert undo_status == 200

    status_code, body = await stack_action(client, "redo", workspace_id=workspace_id)

    assert status_code == 200
    assert body["operationId"] == "redo-2"
    assert body["action"] == "redo"
    assert body["canUndo"] is True
    assert body["canRedo"] is False
    assert await pull_name(client, workspace_id=workspace_id) == "Second"


async def test_stack_undo_is_scoped_by_user_and_session(client: AsyncClient) -> None:
    workspace_id = "history-stack-scope"
    row_id = "hist-scope-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-scope")

    await commit_name(
        client,
        workspace_id=workspace_id,
        row_id=row_id,
        value="User B",
        operation_id="scope-user-b",
        user_id="history-user-b",
        session_id="history-session-b",
    )

    status_code, body = await stack_action(
        client,
        "undo",
        workspace_id=workspace_id,
        user_id="history-user-a",
        session_id="history-session-a",
    )

    assert status_code == 409
    assert body["code"] == "no-undo-available"
    assert await pull_name(client, workspace_id=workspace_id) == "User B"


async def test_new_commit_after_stack_undo_invalidates_redo_branch(client: AsyncClient) -> None:
    workspace_id = "history-stack-branch"
    row_id = "hist-branch-000000"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-branch")

    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="First", operation_id="branch-1")
    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="Second", operation_id="branch-2")
    undo_status, _ = await stack_action(client, "undo", workspace_id=workspace_id)
    assert undo_status == 200

    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="Third", operation_id="branch-3")
    status_code, body = await stack_action(client, "redo", workspace_id=workspace_id)
    discarded_operation = await fetch_operation(workspace_id, "branch-2")

    assert status_code == 409
    assert body["code"] == "no-redo-available"
    assert discarded_operation.status == "discarded"
    assert await pull_name(client, workspace_id=workspace_id) == "Third"


async def test_operation_id_based_undo_redo_still_works(client: AsyncClient) -> None:
    workspace_id = "history-stack-explicit"
    row_id = "hist-explicit-000000"
    operation_id = "explicit-undo-redo"
    await insert_workspace_rows(workspace_id=workspace_id, id_prefix="hist-explicit")
    await commit_name(client, workspace_id=workspace_id, row_id=row_id, value="Explicit", operation_id=operation_id)

    undo_response = await client.post(
        f"/api/server-demo/operations/{operation_id}/undo",
        headers=workspace_headers(workspace_id),
    )
    assert undo_response.status_code == 200
    assert undo_response.json()["operationId"] == operation_id
    assert await pull_name(client, workspace_id=workspace_id) == "Account 00000"

    redo_response = await client.post(
        f"/api/server-demo/operations/{operation_id}/redo",
        headers=workspace_headers(workspace_id),
    )
    assert redo_response.status_code == 200
    assert redo_response.json()["operationId"] == operation_id
    assert await pull_name(client, workspace_id=workspace_id) == "Explicit"
