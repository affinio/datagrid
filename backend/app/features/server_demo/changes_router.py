from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.workspace import WorkspaceContext, get_workspace_context
from app.features.server_demo.repository import ServerDemoRepository
from app.features.server_demo.schemas import ServerDemoChangeFeedResponse
from app.infrastructure.db.database import get_db


router = APIRouter(tags=["changes"])


@router.get("/changes", response_model=ServerDemoChangeFeedResponse)
async def get_changes(
    since_version: int = Query(alias="sinceVersion", ge=0),
    session: AsyncSession = Depends(get_db),
    workspace_context: WorkspaceContext = Depends(get_workspace_context),
) -> ServerDemoChangeFeedResponse:
    repository = ServerDemoRepository(session, workspace_id=workspace_context.workspace_id)
    return await repository.change_feed(since_version)
