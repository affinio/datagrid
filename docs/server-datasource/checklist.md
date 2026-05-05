# Integration Checklist

Use this as a practical checklist for a new table.

## Backend

- [ ] backend package installed
- [ ] model defined
- [ ] columns defined
- [ ] table definition created
- [ ] pull endpoint implemented
- [ ] edit endpoint implemented
- [ ] histogram endpoint implemented
- [ ] fill boundary endpoint implemented
- [ ] fill commit endpoint implemented
- [ ] undo endpoint implemented
- [ ] redo endpoint implemented
- [ ] revision wired
- [ ] workspace header handled
- [ ] consistency metadata preserved
- [ ] legacy `NULL` workspace behavior preserved if needed
- [ ] tests added

## Frontend

- [ ] frontend packages installed
- [ ] HTTP datasource adapter implemented
- [ ] pull mapping implemented
- [ ] histogram mapping implemented
- [ ] edit mapping implemented
- [ ] fill boundary mapping implemented
- [ ] fill commit mapping implemented
- [ ] undo mapping implemented
- [ ] redo mapping implemented
- [ ] warnings surfaced
- [ ] backend errors surfaced

## Validation

- [ ] backend migration applied
- [ ] backend compile check passed
- [ ] backend tests passed
- [ ] browser smoke passed

## Recommended Smoke Path

- [ ] open the grid
- [ ] pull a page of rows
- [ ] edit a cell
- [ ] resolve a fill boundary
- [ ] commit a fill
- [ ] undo the operation
- [ ] redo the operation

## Reference Tests

- `backend/tests/test_server_demo_read.py`
- `backend/tests/test_server_demo_edits.py`
- `backend/tests/test_grid_revision_counter.py`
- `backend/tests/test_grid_revision_workspace.py`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.spec.ts`
