from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.workspace import WorkspaceContext, build_workspace_context, get_optional_workspace_id
from app.features.server_demo.repository import ServerDemoRepository
from app.main import app

@pytest_asyncio.fixture(loop_scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


def test_missing_header_returns_legacy_workspace_context() -> None:
    assert build_workspace_context(None, None) == WorkspaceContext(workspace_id=None, source="legacy")


def test_workspace_header_returns_header_workspace_context() -> None:
    assert build_workspace_context(None, "workspace-a") == WorkspaceContext(
        workspace_id="workspace-a",
        source="header",
    )


def test_auth_workspace_claim_wins_over_header() -> None:
    assert build_workspace_context("auth-workspace", "workspace-a") == WorkspaceContext(
        workspace_id="auth-workspace",
        source="auth",
    )


def test_get_optional_workspace_id_returns_context_value() -> None:
    assert get_optional_workspace_id(WorkspaceContext(workspace_id="workspace-a", source="header")) == "workspace-a"


async def test_server_demo_repository_receives_workspace_id_from_context_dependency(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured_workspace_ids: list[str | None] = []
    original_init = ServerDemoRepository.__init__

    def wrapped_init(self: ServerDemoRepository, session, workspace_id: str | None = None) -> None:
        captured_workspace_ids.append(workspace_id)
        original_init(self, session, workspace_id=workspace_id)

    monkeypatch.setattr(ServerDemoRepository, "__init__", wrapped_init)

    response = await client.get("/api/server-demo/health", headers={"X-Workspace-Id": "workspace-a"})

    assert response.status_code == 200
    assert captured_workspace_ids == ["workspace-a"]
