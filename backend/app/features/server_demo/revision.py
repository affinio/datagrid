from __future__ import annotations

from app.features.server_demo.table import SERVER_DEMO_TABLE
from affino_grid_backend.core.revision import GridRevisionService


class ServerDemoRevisionService(GridRevisionService):
    def __init__(self, workspace_id: str | None = None):
        super().__init__(SERVER_DEMO_TABLE, workspace_id=workspace_id)
