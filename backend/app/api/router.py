from fastapi import APIRouter

from app.api.v1.status.router import router as status_router
from app.features.server_demo.history_router import router as history_router
from app.features.server_demo.router import router as server_demo_router


api_router = APIRouter()
api_router.include_router(status_router)
api_router.include_router(history_router)
api_router.include_router(server_demo_router)
