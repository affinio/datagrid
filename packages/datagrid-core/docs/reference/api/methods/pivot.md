# Pivot methods

`api.pivot` reads and changes analytical pivot state owned by the row model. Pivot output is part of the current projection. Rendering pivot headers, column materialization, and drilldown UI remain adapter/application work.

| Method | Contract |
| --- | --- |
| `setModel(pivotModel)` | Replaces the pivot configuration; `null` disables pivoting. This is a model mutation and can recompute the projection. |
| `getModel()` | Returns the current pivot specification or `null` when pivoting is off. |
| `getCellDrilldown(input)` | Resolves source-row drilldown for a pivot cell when the row model implements it; otherwise returns `null`. It does not perform navigation or mutate the grid. |
| `exportLayout()` | Captures a version-1 pivot layout containing sort, filter, grouping, pivot, aggregation, group expansion, and column order/visibility/width/pin state. It does not mutate the runtime. |
| `exportInterop()` | Returns a version-1 interop snapshot containing the exported layout, generated pivot columns, and currently projected row nodes. Returns `null` when no pivot model is active. This is a materialized transfer snapshot, not a remote query request. |
| `importLayout(layout, options?)` | Applies the supplied layout to the current row/column models. Column state is applied unless `applyColumnState` is false. Sort/filter are applied together when the batch capability exists, otherwise sequentially; group, pivot, aggregation, and expansion state are then applied. An unchanged serializable layout is a no-op. |

Import is not a general atomic state restore: the method does not expose rollback or a structured failure result. Validate external layouts before applying and use `api.state.set` when the wider versioned grid-state contract is appropriate. `exportLayout`/`importLayout` serve reusable pivot configurations; `exportInterop` includes current projected data for interchange.
