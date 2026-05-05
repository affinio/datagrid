from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, Header

from app.api.errors import ApiException
from app.core.config import Settings, get_settings


WorkspaceContextSource = Literal["auth", "header", "legacy"]


@dataclass(frozen=True)
class WorkspaceContext:
    workspace_id: str | None
    source: WorkspaceContextSource


async def get_authenticated_workspace_id() -> str | None:
    """Placeholder for future auth/session tenant binding.

    Production code should populate workspace identity from authenticated
    session or tenant context. The server-demo router currently falls back to
    the sandbox/dev header path for compatibility.
    """

    return None


def build_workspace_context(
    authenticated_workspace_id: str | None,
    header_workspace_id: str | None,
    *,
    allow_workspace_header_fallback: bool = True,
) -> WorkspaceContext:
    if authenticated_workspace_id is not None:
        return WorkspaceContext(workspace_id=authenticated_workspace_id, source="auth")
    if header_workspace_id is not None:
        if not allow_workspace_header_fallback:
            raise ApiException(
                status_code=403,
                code="workspace-header-not-allowed",
                message="Workspace header fallback is disabled",
            )
        return WorkspaceContext(workspace_id=header_workspace_id, source="header")
    return WorkspaceContext(workspace_id=None, source="legacy")


def get_workspace_context(
    authenticated_workspace_id: str | None = Depends(get_authenticated_workspace_id),
    header_workspace_id: str | None = Header(default=None, alias="X-Workspace-Id"),
    settings: Settings = Depends(get_settings),
) -> WorkspaceContext:
    return build_workspace_context(
        authenticated_workspace_id,
        header_workspace_id,
        allow_workspace_header_fallback=settings.grid_allow_workspace_header_fallback,
    )


def get_optional_workspace_id(
    workspace_context: WorkspaceContext = Depends(get_workspace_context),
) -> str | None:
    return workspace_context.workspace_id
