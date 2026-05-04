from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.errors import ApiException
from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting FastAPI application")
    yield
    logger.info("Stopping FastAPI application")


async def api_exception_handler(_: object, exc: ApiException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
        },
    )


app = FastAPI(
    title=settings.app_name,
    description=settings.description,
    version=settings.app_version,
    debug=False,
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api")
app.add_exception_handler(ApiException, api_exception_handler)
