"""add workspace_id to grid_demo_rows

Revision ID: 20260505_0004
Revises: 20260505_0003
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260505_0004"
down_revision: Union[str, None] = "20260505_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("grid_demo_rows", sa.Column("workspace_id", sa.String(), nullable=True))
    op.create_index("ix_grid_demo_rows_workspace_id", "grid_demo_rows", ["workspace_id"], unique=False)
    op.create_index(
        "ix_grid_demo_rows_workspace_id_row_index",
        "grid_demo_rows",
        ["workspace_id", "row_index"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_grid_demo_rows_workspace_id_row_index", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_workspace_id", table_name="grid_demo_rows")
    op.drop_column("grid_demo_rows", "workspace_id")
