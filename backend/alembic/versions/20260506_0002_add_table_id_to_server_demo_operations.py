"""add table scope to server demo operations

Revision ID: 20260506_0002
Revises: 20260506_0001
Create Date: 2026-05-06 00:00:01.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260506_0002"
down_revision: Union[str, None] = "20260506_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "server_demo_operations",
        sa.Column("table_id", sa.String(), nullable=False, server_default=sa.text("'server_demo'")),
    )
    op.drop_index(
        "ix_server_demo_operations_workspace_user_session_status_created",
        table_name="server_demo_operations",
    )
    op.create_index(
        "ix_srv_demo_ops_ws_tbl_user_session_status_created",
        "server_demo_operations",
        ["workspace_id", "table_id", "user_id", "session_id", "status", "created_at"],
        unique=False,
    )
    op.create_index("ix_server_demo_operations_table_id", "server_demo_operations", ["table_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_server_demo_operations_table_id", table_name="server_demo_operations")
    op.drop_index(
        "ix_srv_demo_ops_ws_tbl_user_session_status_created",
        table_name="server_demo_operations",
    )
    op.create_index(
        "ix_server_demo_operations_workspace_user_session_status_created",
        "server_demo_operations",
        ["workspace_id", "user_id", "session_id", "status", "created_at"],
        unique=False,
    )
    op.drop_column("server_demo_operations", "table_id")
