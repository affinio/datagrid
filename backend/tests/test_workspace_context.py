from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import app.core.workspace as workspace_module
from app.api.errors import ApiException
from app.core.config import Settings
from app.core.workspace import WorkspaceContext, build_workspace_context, get_optional_workspace_id
from app.features.server_demo.repository import ServerDemoRepository
from app.main import app


@pytest.fixture(autouse=True)
def restore_dependency_overrides() -> None:
    original_overrides = dict(app.dependency_overrides)
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original_overrides)


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


def test_default_config_allows_workspace_header_fallback() -> None:
    assert build_workspace_context(None, "workspace-a") == WorkspaceContext(
        workspace_id="workspace-a",
        source="header",
    )


def test_workspace_header_rejected_when_fallback_disabled() -> None:
    with pytest.raises(ApiException) as exc_info:
        build_workspace_context(None, "workspace-a", allow_workspace_header_fallback=False)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "workspace-header-not-allowed"
    assert exc_info.value.message == "Workspace header fallback is disabled"


def test_workspace_header_missing_returns_legacy_when_fallback_disabled() -> None:
    assert build_workspace_context(None, None, allow_workspace_header_fallback=False) == WorkspaceContext(
        workspace_id=None,
        source="legacy",
    )


def test_auth_workspace_claim_wins_even_when_fallback_disabled() -> None:
    assert build_workspace_context("auth-workspace", "workspace-a", allow_workspace_header_fallback=False) == WorkspaceContext(
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


async def test_server_demo_route_rejects_header_when_fallback_disabled(client: AsyncClient) -> None:
    app.dependency_overrides[workspace_module.get_settings] = lambda: Settings(
        grid_allow_workspace_header_fallback=False,
    )

    response = await client.get("/api/server-demo/health", headers={"X-Workspace-Id": "workspace-a"})

    assert response.status_code == 403
    assert response.json() == {
        "code": "workspace-header-not-allowed",
        "message": "Workspace header fallback is disabled",
    }
