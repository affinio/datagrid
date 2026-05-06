"""add user and session scope to server demo operations

Revision ID: 20260506_0001
Revises: 20260505_0005
Create Date: 2026-05-06 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260506_0001"
down_revision: Union[str, None] = "20260505_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_server_demo_operations_status", "server_demo_operations", type_="check")
    op.create_check_constraint(
        "ck_server_demo_operations_status",
        "server_demo_operations",
        "status in ('applied', 'undone', 'discarded')",
    )
    op.add_column("server_demo_operations", sa.Column("user_id", sa.String(), nullable=True))
    op.add_column("server_demo_operations", sa.Column("session_id", sa.String(), nullable=True))
    op.create_index(
        "ix_server_demo_operations_workspace_user_session_status_created",
        "server_demo_operations",
        ["workspace_id", "user_id", "session_id", "status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_server_demo_operations_workspace_user_session_status_created",
        table_name="server_demo_operations",
    )
    op.drop_column("server_demo_operations", "session_id")
    op.drop_column("server_demo_operations", "user_id")
    op.execute(sa.text("UPDATE server_demo_operations SET status = 'undone' WHERE status = 'discarded'"))
    op.drop_constraint("ck_server_demo_operations_status", "server_demo_operations", type_="check")
    op.create_check_constraint(
        "ck_server_demo_operations_status",
        "server_demo_operations",
        "status in ('applied', 'undone')",
    )
