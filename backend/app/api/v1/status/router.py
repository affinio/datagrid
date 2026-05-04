from fastapi import APIRouter

from app.schemas.status import StatusResponse


router = APIRouter(prefix="/status", tags=["status"])


@router.get("", response_model=StatusResponse)
async def get_status() -> StatusResponse:
    return StatusResponse(message="hello from backend")