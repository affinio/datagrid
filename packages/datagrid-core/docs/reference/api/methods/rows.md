# Rows and projection methods

These methods are exposed by `api.rows`. Reads address the active row model. A row index therefore means an index in the current projection, while a source mutation index may have its own explicitly documented source-order meaning.

## Read rows

| Method | Contract |
| --- | --- |
| `getSnapshot()` | Returns the model snapshot, including current projection and pagination metadata. Read it again after a change; event payloads are notifications, not a replacement for the current snapshot. |
| `getCount()` | Returns the number of rows in the current projection, including synthetic rows exposed by the model. |
| `get(index)` | Returns the projected node at a zero-based index, or `undefined` outside the current projection. Sorting, filtering, grouping, tree expansion, pivoting, and pagination can change what an index identifies. |
| `getRange({ start, end })` | Reads an inclusive viewport range from the current projection. This is a model read and does not scroll or materialize DOM. |
| `getById(rowId)` | Looks up a locally available source row by stable ID. It does not search the projected index, expand groups, load missing rows, or reveal the result. It returns `undefined` when lookup is unsupported or the row is unavailable. |
| `resolveById(rowId)` | Returns an explicit `loaded` result with the row, `filtered-out`, `ancestor-collapsed`, `not-loaded`, `not-found`, or `unsupported`. It does not fetch or reveal a row. Use it when missing and unavailable must be distinguished. |
| `getProjectedRows()` | Returns a new array of leaf row data in projected order. Group/header nodes are excluded; row objects themselves are not cloned. |

Use `get(index)` for rendering the current view, `getById` for a best-effort identity lookup, `resolveById` for a structured identity lookup, and `getProjectedRows()` when a consumer explicitly needs leaf data in display order. A server row model without stable-ID lookup returns `unsupported`; when lookup is supported but the row is absent from incomplete loaded intervals it returns `not-loaded`. Do not persist row indexes as identity.

## Source-data mutations

| Method | Contract |
| --- | --- |
| `hasDataMutationSupport()` | Reports whether the bound model supports the facade's insert/replace-style source mutation methods. |
| `hasInsertSupport()` | Reports whether all three stable/positional insertion operations are available. |
| `hasRowIdLookupSupport()` | Reports local stable-ID lookup support for `getById`. |
| `hasRemoveSupport()` | Reports source-row removal support. |
| `setData(rows)` | Replaces source rows through the mutation capability. It does not create a transaction-history entry. |
| `replaceData(rows)` | Uses the model's dedicated replacement operation when available; otherwise it follows the source replacement path used by `setData`. |
| `appendData(rows)` / `prependData(rows)` | Add rows at the end or beginning of source order. Projection rules may place them elsewhere in the visible result. |
| `insertDataAt(index, rows)` | Inserts at the source-order position supported by the model; client model indexes are clamped to source bounds. Its index is not a displayed projection index. |
| `insertDataBefore(rowId, rows)` / `insertDataAfter(rowId, rows)` | Inserts relative to a stable source row identity. Throws when the corresponding insertion capability is missing; returns the model's boolean result, including `false` when the target or insertion is unavailable. |
| `removeData(rowIds)` | Removes matching source rows by stable ID and returns `true` only if at least one row was removed. Missing and duplicate IDs are ignored. It is a direct mutation, not generic transaction history. |

Unsupported mutation methods throw a capability error. A successful client-model mutation updates its projection synchronously. Removing rows clears matching focused/selected row IDs when row-selection support is available; consumers should still treat the resulting `rows:changed` snapshot as authoritative.

## Projection and grouping

| Method | Contract |
| --- | --- |
| `getPagination()` | Returns the model's current pagination snapshot. |
| `setPagination(pagination)` | Replaces pagination state; `null` disables pagination. |
| `setPageSize(pageSize)` | Sets a page size or uses `null` to disable page-size limiting, subject to the row model's pagination contract. |
| `setCurrentPage(page)` | Sets the zero-based current page index. The model applies its own bounds normalization. |
| `setSortModel(sortModel)` | Replaces the active sort specification and recomputes projection as the model requires. |
| `setFilterModel(filterModel)` | Replaces the active filter snapshot; `null` clears it. |
| `setSortAndFilterModel(input)` | Applies sort and filter together through the optional batch capability when present. Without it, the facade calls filter then sort sequentially, which can cause two model updates. |
| `setGroupBy(groupBy)` | Replaces grouping configuration; `null` disables grouping. |
| `setAggregationModel(model)` / `getAggregationModel()` | Replaces or reads row aggregation configuration. Passing `null` disables aggregation. |
| `setGroupExpansion(expansion)` | Replaces the complete expansion snapshot. |
| `toggleGroup(groupKey)` | Toggles one group expansion key. |
| `expandGroup(groupKey)` / `collapseGroup(groupKey)` | Idempotently requests one group to be expanded or collapsed. |
| `expandAllGroups()` / `collapseAllGroups()` | Applies the corresponding operation to every group in the current grouping model. |
| `setAutoReapply(value)` / `getAutoReapply()` | Sets or reads the default policy for whether row edits reapply the current projection. It does not immediately reapply the view. |

Projection changes are reported through `rows:changed`; when the projection revision changes, `projection:recomputed` is also emitted. Use `setSortAndFilterModel` when both values form one user action, and check `api.capabilities.sortFilterBatch` when one atomic projection update matters.

## Patches, edits, and external updates

| Method | Contract |
| --- | --- |
| `hasPatchSupport()` | Reports whether the model accepts patch updates to existing rows. |
| `patch(updates, options)` | Applies client-style updates keyed by row ID. Projection reapplication is controlled by `options`; the default does not automatically recompute the view. This path is not automatically recorded in generic transaction history. |
| `applyEdits(updates, options)` | Applies user-edit patches through the model's edit path. May be synchronous or return a Promise for datasource-backed models. The result can be affected by abort and projection reapply options. |
| `hasExternalUpdateSupport()` | Reports whether external/cache-originated updates are supported. |
| `applyExternalUpdates(updates, options)` | Applies updates from an external source, distinct from a user edit. May be asynchronous and follows its separate external-update policy. |

Await `applyEdits` or `applyExternalUpdates` when the returned value is a Promise. User edits and external updates are not interchangeable: choose based on where the change originated, because model policy, event source, and datasource behavior can differ. Successful edit notifications use `rows:edited`; model snapshots use `rows:changed`.

## Computed and formula fields

| Method | Contract |
| --- | --- |
| `hasComputedSupport()` / `hasFormulaSupport()` | Reports whether the bound model supports the respective field type. |
| `registerComputedField(definition)` | Registers a computed field with a row-level compute definition. Unsupported models throw. |
| `registerFormulaField(definition)` | Registers a formula-backed field using the formula engine contract. |
| `getComputedFields()` / `getFormulaFields()` | Returns immutable field descriptors for the corresponding registry. |
| `unregisterComputedField(name)` / `unregisterFormulaField(name)` | Removes a field by name and returns `false` if it does not exist. Removal throws without changing the registry if another registered field depends on it. |
| `hasComputedUnregisterSupport()` / `hasFormulaUnregisterSupport()` | Reports whether removal is implemented for that registry. |
| `recomputeComputedFields(rowIds?)` | Recomputes computed/formula fields for all rows or the supplied IDs. Returns the number of rows processed. |
| `recomputeFormulaContext(request)` | Recomputes formulas affected by the external context keys in the request. Returns the number of affected rows processed. |
| `hasFormulaFunctionRegistrySupport()` | Reports whether formula functions can be registered dynamically. |
| `registerFormulaFunction(name, definition)` | Adds or replaces the named formula function. The function receives argument values and may receive compute context according to its definition type. |
| `unregisterFormulaFunction(name)` | Removes the function and returns whether one existed. |
| `getFormulaFunctionNames()` | Returns the registered function names. |

Field registries are model state. Register related definitions before depending on their values; unregistering a dependency is rejected while dependents remain. See the formula engine guide for expression syntax and context invalidation.

## Batching

| Method | Contract |
| --- | --- |
| `batch(fn)` | Runs `fn` while public API event delivery is batched, returns the callback result, and propagates callback errors. It does not promise one model recomputation or one transaction entry. |
| `batchMutations(fn)` | Runs synchronous source mutations inside a model batch when supported, coalescing projection recomputation. It is not an asynchronous transaction; do not return a Promise expecting later mutations to join the batch. |

Use `batch` to group notifications. Use `batchMutations` when a supported client row model should recompute once for several synchronous data mutations. Use `api.transaction` when undo/redo history is required.
