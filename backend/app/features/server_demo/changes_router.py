from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.workspace import WorkspaceContext, build_workspace_context, get_workspace_context
from app.features.server_demo.repository import ServerDemoRepository
from app.features.server_demo.schemas import ServerDemoChangeFeedResponse
from app.infrastructure.db.database import AsyncSessionLocal, get_db


router = APIRouter(tags=["changes"])


@router.get("/changes", response_model=ServerDemoChangeFeedResponse)
async def get_changes(
    since_version: int = Query(alias="sinceVersion", ge=0),
    session: AsyncSession = Depends(get_db),
    workspace_context: WorkspaceContext = Depends(get_workspace_context),
) -> ServerDemoChangeFeedResponse:
    repository = ServerDemoRepository(session, workspace_id=workspace_context.workspace_id)
    return await repository.change_feed(since_version)


@router.websocket("/changes/ws")
async def changes_websocket(
    websocket: WebSocket,
    since_version: int = Query(default=0, alias="sinceVersion", ge=0),
    interval_ms: int = Query(default=500, alias="intervalMs", ge=250, le=10_000),
) -> None:
    settings = get_settings()
    workspace_context = build_workspace_context(
        authenticated_workspace_id=None,
        header_workspace_id=websocket.headers.get("x-workspace-id"),
        allow_workspace_header_fallback=settings.grid_allow_workspace_header_fallback,
    )
    await websocket.accept()
    cursor = since_version
    try:
        while True:
            async with AsyncSessionLocal() as session:
                repository = ServerDemoRepository(session, workspace_id=workspace_context.workspace_id)
                response = await repository.change_feed(cursor)
            payload = response.model_dump(mode="json", by_alias=True)
            if response.dataset_version > cursor or response.changes:
                await websocket.send_json(payload)
                cursor = response.dataset_version
            await asyncio.sleep(interval_ms / 1000)
    except WebSocketDisconnect:
        return
