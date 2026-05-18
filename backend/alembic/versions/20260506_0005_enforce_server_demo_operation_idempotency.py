"""enforce server demo operation idempotency

Revision ID: 20260506_0005
Revises: 20260506_0004
Create Date: 2026-05-06 00:05:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260506_0005"
down_revision = "20260506_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_server_demo_operations_scope_operation
            ON server_demo_operations (operation_id, COALESCE(workspace_id, ''), table_id)
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_server_demo_operations_scope_operation"))
