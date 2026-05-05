from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.server_demo.models import GridDemoRow as GridDemoRowModel


class ServerDemoRevisionService:
    async def get_revision(self, session: AsyncSession) -> str:
        stmt = select(func.max(GridDemoRowModel.updated_at)).select_from(GridDemoRowModel)
        revision = await session.scalar(stmt)
        if revision is None:
            return "empty"
        return revision.isoformat()

