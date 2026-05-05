from __future__ import annotations

from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.grid.revision import GridRevisionService


class ServerDemoRevisionService(GridRevisionService):
    def __init__(self):
        super().__init__(SERVER_DEMO_TABLE)
