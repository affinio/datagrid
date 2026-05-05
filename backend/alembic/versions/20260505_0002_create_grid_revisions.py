"""create grid_revisions table

Revision ID: 20260505_0002
Revises: 20260505_0001
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260505_0002"
down_revision: Union[str, None] = "20260505_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grid_revisions",
        sa.Column("table_id", sa.String(), primary_key=True, nullable=False),
        sa.Column("revision", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("grid_revisions")
