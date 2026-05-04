# Demo Backend

FastAPI backend for the Affino DataGrid server datasource demo.

## Local environment

```bash
cd backend
uv sync
```

## Run API

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Alembic

```bash
cd backend
uv run alembic upgrade head
```

## Seed

```bash
cd backend
uv run python -m app.features.server_demo.seed
```