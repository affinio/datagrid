from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.server_demo.repository import ServerDemoRepository
from app.features.server_demo.schemas import (
    ServerDemoHistoryStackRequest,
    ServerDemoHistoryStackResponse,
    ServerDemoHistoryStatusRequest,
    ServerDemoHistoryStatusResponse,
)
from app.infrastructure.db.database import get_db


router = APIRouter(prefix="/history", tags=["history"])


@router.post("/undo", response_model=ServerDemoHistoryStackResponse)
async def undo_latest_operation(
    request: ServerDemoHistoryStackRequest,
    session: AsyncSession = Depends(get_db),
) -> ServerDemoHistoryStackResponse:
    repository = ServerDemoRepository(session, workspace_id=request.workspace_id)
    return await repository.undo_latest_operation(request)


@router.post("/redo", response_model=ServerDemoHistoryStackResponse)
async def redo_latest_operation(
    request: ServerDemoHistoryStackRequest,
    session: AsyncSession = Depends(get_db),
) -> ServerDemoHistoryStackResponse:
    repository = ServerDemoRepository(session, workspace_id=request.workspace_id)
    return await repository.redo_latest_operation(request)


@router.post("/status", response_model=ServerDemoHistoryStatusResponse)
async def history_status(
    request: ServerDemoHistoryStatusRequest,
    session: AsyncSession = Depends(get_db),
) -> ServerDemoHistoryStatusResponse:
    repository = ServerDemoRepository(session, workspace_id=request.workspace_id)
    return await repository.history_status(request)
