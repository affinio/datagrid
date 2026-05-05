from __future__ import annotations

from fastapi import APIRouter, Depends

from app.features.server_demo.repository import ServerDemoRepository
from app.features.server_demo.schemas import (
    ServerDemoCommitEditsRequest,
    ServerDemoCommitEditsResponse,
    ServerDemoFillBoundaryRequest,
    ServerDemoFillBoundaryResponse,
    ServerDemoFillCommitRequest,
    ServerDemoFillCommitResponse,
    ServerDemoHealthResponse,
    ServerDemoHistogramRequest,
    ServerDemoHistogramResponse,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
)
from app.infrastructure.db.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/server-demo", tags=["server-demo"])


def get_server_demo_repository(session: AsyncSession = Depends(get_db)) -> ServerDemoRepository:
    return ServerDemoRepository(session)


@router.get("/health", response_model=ServerDemoHealthResponse)
async def health(repository: ServerDemoRepository = Depends(get_server_demo_repository)) -> ServerDemoHealthResponse:
    await repository.health()
    return ServerDemoHealthResponse(status="ok")


@router.post("/pull", response_model=ServerDemoPullResponse)
async def pull(
    request: ServerDemoPullRequest,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoPullResponse:
    return await repository.pull(request)


@router.post("/histogram", response_model=ServerDemoHistogramResponse)
async def histogram(
    request: ServerDemoHistogramRequest,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoHistogramResponse:
    return await repository.histogram(request.column_id, request.filter_model)


@router.post("/edits", response_model=ServerDemoCommitEditsResponse)
async def commit_edits(
    request: ServerDemoCommitEditsRequest,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoCommitEditsResponse:
    return await repository.commit_edits(request)


@router.post("/fill-boundary", response_model=ServerDemoFillBoundaryResponse)
async def resolve_fill_boundary(
    request: ServerDemoFillBoundaryRequest,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoFillBoundaryResponse:
    return await repository.resolve_fill_boundary(request)


@router.post("/fill/commit", response_model=ServerDemoFillCommitResponse)
async def commit_fill(
    request: ServerDemoFillCommitRequest,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoFillCommitResponse:
    return await repository.commit_fill(request)


@router.post("/operations/{operation_id}/undo", response_model=ServerDemoCommitEditsResponse)
async def undo_operation(
    operation_id: str,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoCommitEditsResponse:
    return await repository.undo_operation(operation_id)


@router.post("/operations/{operation_id}/redo", response_model=ServerDemoCommitEditsResponse)
async def redo_operation(
    operation_id: str,
    repository: ServerDemoRepository = Depends(get_server_demo_repository),
) -> ServerDemoCommitEditsResponse:
    return await repository.redo_operation(operation_id)
