"""create grid_demo_rows table

Revision ID: 20260504_0001
Revises: 
Create Date: 2026-05-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260504_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grid_demo_rows",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("segment", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_grid_demo_rows_row_index", "grid_demo_rows", ["row_index"], unique=False)
    op.create_index("ix_grid_demo_rows_region", "grid_demo_rows", ["region"], unique=False)
    op.create_index("ix_grid_demo_rows_segment", "grid_demo_rows", ["segment"], unique=False)
    op.create_index("ix_grid_demo_rows_status", "grid_demo_rows", ["status"], unique=False)
    op.create_index("ix_grid_demo_rows_value", "grid_demo_rows", ["value"], unique=False)
    op.create_index("ix_grid_demo_rows_updated_at", "grid_demo_rows", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_grid_demo_rows_updated_at", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_value", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_status", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_segment", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_region", table_name="grid_demo_rows")
    op.drop_index("ix_grid_demo_rows_row_index", table_name="grid_demo_rows")
    op.drop_table("grid_demo_rows")
