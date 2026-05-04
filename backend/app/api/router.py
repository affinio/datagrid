from fastapi import APIRouter

from app.api.v1.status.router import router as status_router


api_router = APIRouter()
api_router.include_router(status_router)
