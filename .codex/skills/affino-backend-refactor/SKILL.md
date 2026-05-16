---
name: affino-backend-refactor
description: Use for Affino backend architecture work involving FastAPI services, server datasources, HTTP datasource protocols, Postgres persistence, revisions, consistency, undo/redo history, migrations, backend tests, and refactors that affect server-side data contracts.
---

# Affino Backend Refactor

## Scope

Use this skill for backend slices that touch API behavior, datasource consistency, persistence, revisions, server history, and backend-facing integration contracts.

## Working Rules

- Preserve existing API contracts unless the user explicitly asks for a public contract change.
- If a public API/protocol change is needed, propose the shape first and wait for approval.
- Keep backend, sandbox, DataGrid core, and demo app boundaries explicit.
- Prefer production-shaped code paths over demo-only shortcuts.
- Treat revision IDs, operation IDs, and history entries as consistency boundaries.
- Avoid broad rewrites of datasource plumbing unless the slice requires it.

## Backend Slice Workflow

1. Identify the owning package/service and the external contract it exposes.
2. Trace read/write paths through request models, service logic, storage, and response models.
3. Check consistency semantics: revision stability, idempotency, optimistic concurrency, rollback, undo/redo, and partial failure behavior.
4. Make the smallest coherent change.
5. Add or update focused tests at the service/protocol boundary.
6. Update relevant docs when behavior, protocols, or migration expectations change.

## Validation

- Prefer targeted backend tests first.
- Run package-level type-check/build for affected backend packages.
- For FastAPI changes, cover request/response shape and failure paths.
- For persistence changes, cover empty state, repeated writes, stale revision, and rollback behavior where relevant.

## Reporting

- Report behavior changed, validation run, unresolved consistency risks, and a scoped commit message.
