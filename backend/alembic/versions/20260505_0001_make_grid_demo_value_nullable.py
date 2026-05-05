"""make grid demo value nullable

Revision ID: 20260505_0001
Revises: 20260504_0003
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260505_0001"
down_revision: Union[str, None] = "20260504_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "grid_demo_rows",
        "value",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE grid_demo_rows
            SET value = 0
            WHERE value IS NULL
            """
        )
    )
    op.alter_column(
        "grid_demo_rows",
        "value",
        existing_type=sa.Integer(),
        nullable=False,
    )
