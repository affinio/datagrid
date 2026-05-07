# Frontend Adapter Reference

The reference HTTP datasource adapter lives at:

- [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts)

The fill wrapper lives at:

- [`packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts)

## What The Adapter Does

The opinionated adapter translates `DataGridDataSource<T>` calls into backend HTTP requests.

If you only need the lower-level transport and change-feed utilities, use `@affino/datagrid-server-client` directly. Most users should still start with `@affino/datagrid-server-adapters`.

It handles:

- pull requests
- column histograms
- edit commits
- fill boundary resolution
- fill commit
- stack undo / redo
- error normalization
- basic invalidation normalization

The adapter is intentionally thin. It does not try to reimplement the backend logic in the browser.
The current reference adapter also keeps `subscribe()` as a local listener registry only. There is no backend push channel wired up yet, so polling or change-feed refresh is the current fallback path.

## Request Mapping

### `pull()`

Maps to `POST /api/server-demo/pull`.

It:

- normalizes the viewport range
- converts the grid sort model to backend `sortModel`
- flattens the grid filter snapshot into a backend `filterModel`
- sends the request with the abort signal
- returns `rows`, `total`, `revision`, and `datasetVersion`

### `getColumnHistogram()`

Maps to `POST /api/server-demo/histogram`.

It:

- removes the current column filter when `ignoreSelfFilter` is enabled
- forwards the rest of the projection context
- applies local search, limit, and ordering to the returned histogram entries

That means the backend only has to return the raw histogram domain for the active projection. The adapter keeps the UI behavior aligned with the existing grid histogram controls.

### `commitEdits()`

Maps to `POST /api/server-demo/edits`.

It flattens the grid edit payload into a backend `edits[]` array:

- `rowId`
- `columnId`
- `value`
- `previousValue`
- `revision`

If the grid sends a revision on the request, the adapter forwards it into each backend edit item.

### `resolveFillBoundary()`

Maps to `POST /api/server-demo/fill-boundary`.

It preserves:

- `direction`
- `baseRange`
- `fillColumns`
- `referenceColumns`
- `projection`
- `startRowIndex`
- `startColumnIndex`
- `limit`

### `commitFillOperation()`

Maps to `POST /api/server-demo/fill/commit`.

It preserves the fill metadata that the grid needs for consistency checks:

- `operationId`
- `revision`
- `baseRevision`
- `projectionHash`
- `boundaryToken`
- `sourceRange`
- `targetRange`
- `sourceRowIds`
- `targetRowIds`
- `fillColumns`
- `referenceColumns`
- `mode`
- `projection`
- `metadata`

Current adapter behavior:

- `series` mode is downgraded to `copy` before posting
- backend invalidation is normalized into the grid invalidation shape
- backend warnings are surfaced as the `warnings` array on the result

### `undoOperation()` / `redoOperation()`

Maps to:

- normal UX: `POST /api/history/undo`, `POST /api/history/redo`, `POST /api/history/status`
- legacy/debug/manual replay: `POST /api/server-demo/operations/{operation_id}/undo`
- legacy/debug/manual replay: `POST /api/server-demo/operations/{operation_id}/redo`

The fill-specific wrapper uses the same routes for `undoFillOperation()` and `redoFillOperation()`.

## How Errors Are Surfaced

The adapter turns non-2xx responses into `ServerDemoHttpError`.

That error contains:

- `status`
- `code`
- `details`

The adapter reads the backend JSON body if possible and uses the backend `message` and `code` fields when present.

This is important for fill consistency failures because the frontend can tell the difference between:

- stale revision
- projection mismatch
- boundary mismatch
- invalid-since-version

## How Fill Metadata Is Preserved

Fill operations depend on more than row values. The adapter forwards the full metadata bundle so the backend can validate that the request still matches the boundary the user saw.

It keeps:

- the original fill projection snapshot
- the source and target row ids
- the fill and reference column sets
- the operation id
- revision metadata
- consistency tokens

This is the part that makes server-backed fill feel deterministic rather than approximate.

## Warnings And Invalidation

The backend may return warnings for a fill commit, including no-op fill cases or ignored columns. The adapter exposes those warnings directly.

Invalidation is normalized to the grid's range invalidation shape when the backend returns a range payload. If the payload cannot be interpreted as a range, the adapter drops it rather than inventing a fake invalidation.
Current backend invalidations are shaped as:

- `cell`
- `range`
- `row`
- `dataset`

The adapter should preserve those semantics when it can and avoid fabricating a more specific invalidation than the backend returned.

## Related Demo Code

- [`packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`](../../packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue)
- [`packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts`](../../packages/datagrid-sandbox/src/serverDatasourceDemo/types.ts)
