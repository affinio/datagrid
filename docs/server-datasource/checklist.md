# Implementation Checklist

Use this as a practical slice-by-slice checklist when building your own backend datasource.

## Data Model

- [ ] Define the row schema
- [ ] Define stable row ids
- [ ] Define a row index or equivalent ordering key
- [ ] Decide which columns are editable
- [ ] Decide which columns are sortable
- [ ] Decide which columns are filterable
- [ ] Decide which columns support histograms
- [ ] Decide which columns should remain read-only

## Pull

- [ ] Implement `POST /pull`
- [ ] Support row range requests
- [ ] Support sort model translation
- [ ] Support filter model translation
- [ ] Return total row count
- [ ] Return the current revision
- [ ] Keep row ids stable across refreshes

## Histograms

- [ ] Implement `POST /histogram`
- [ ] Respect the active filter projection
- [ ] Preserve column identity in the response
- [ ] Return exact counts for each bucket or value
- [ ] Decide which columns are intentionally unsupported

## Edit Commit

- [ ] Implement `POST /edits`
- [ ] Accept batch edits
- [ ] Enforce `baseRevision` for stale-write protection
- [ ] Validate `previousValue` when the client supplies it
- [ ] Reject read-only columns
- [ ] Reject unknown columns
- [ ] Return committed and rejected items separately
- [ ] Bump the revision only when at least one row changes
- [ ] Return invalidation metadata

## Fill Boundary

- [ ] Implement `POST /fill-boundary`
- [ ] Accept the current projection snapshot
- [ ] Accept fill and reference column sets
- [ ] Resolve the boundary against the current projection
- [ ] Return `revision`
- [ ] Return `projectionHash`
- [ ] Return `boundaryToken`
- [ ] Keep the scan bounded

## Fill Commit

- [ ] Implement `POST /fill/commit`
- [ ] Preserve the original fill metadata
- [ ] Enforce `baseRevision` when provided
- [ ] Enforce `projectionHash` when provided
- [ ] Enforce `boundaryToken` when provided
- [ ] Reject unsupported `series` mode until you actually support it
- [ ] Return operation id
- [ ] Return affected row count
- [ ] Return affected cell count
- [ ] Return warnings for partial application or no-op cases
- [ ] Return invalidation metadata

## Operation History

- [ ] Store operation headers by operation id
- [ ] Store cell-level before/after events
- [ ] Implement undo by operation id
- [ ] Implement redo by operation id
- [ ] Keep history scoped to the workspace or tenant boundary you chose
- [ ] Decide whether duplicate operation ids are rejected

## Revision

- [ ] Implement monotonic revision tracking
- [ ] Scope revision by workspace if needed
- [ ] Expose the revision in reads and writes
- [ ] Use the revision for stale-write rejection
- [ ] Make revision bumps transactional

## Frontend Adapter

- [ ] Map `pull()` to the backend pull endpoint
- [ ] Map `getColumnHistogram()` to the histogram endpoint
- [ ] Map `commitEdits()` to the edit endpoint
- [ ] Map `resolveFillBoundary()` to the fill-boundary endpoint
- [ ] Map `commitFillOperation()` to the fill-commit endpoint
- [ ] Map undo and redo to operation endpoints
- [ ] Preserve fill metadata in the client request body
- [ ] Surface backend warnings in the grid UI
- [ ] Surface backend errors with status and code

## Validation

- [ ] Run backend tests for pull, edit, fill, history, and revision behavior
- [ ] Run adapter tests for request mapping and error handling
- [ ] Run a manual grid smoke test with pull, edit, fill, undo, and redo
- [ ] Verify workspace-scoped revision behavior if your backend uses it
- [ ] Verify stale-revision rejection paths

## Reference Test Locations

- `backend/tests/test_server_demo_read.py`
- `backend/tests/test_server_demo_edits.py`
- `backend/tests/test_grid_revision_counter.py`
- `backend/tests/test_grid_revision_workspace.py`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.spec.ts`
