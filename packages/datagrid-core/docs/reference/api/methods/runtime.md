# Runtime, capability, and diagnostics methods

## Lifecycle and top-level methods

| Method / property | Contract |
| --- | --- |
| `lifecycle.state` | Current Core lifecycle state. Read-only. |
| `lifecycle.startupOrder` | Service startup order configured for this Core instance. Read-only metadata. |
| `lifecycle.isBusy()` | Reports whether guarded exclusive work is active or queued. It is not a browser-render or network-idle signal. |
| `lifecycle.whenIdle()` | Resolves when the guarded API operation queue drains. It does not wait for arbitrary async model work, host rendering, or unguarded sync mutations. |
| `lifecycle.runExclusive(fn)` | Runs callback work in the lifecycle's exclusive queue and resolves with its result. Use for orchestration that must serialize against other guarded operations. |
| `init()` | Initializes registered Core services. Safe to call before `start()` when initialization and startup must be separated. |
| `start()` | Initializes services when needed, then starts them in configured order. |
| `stop()` | Stops running services while retaining a non-disposed Core that may be started again if its services support restart. |
| `dispose()` | Performs terminal teardown. Do not reuse the API after disposal. |

Await lifecycle methods before relying on service readiness. Disposing is terminal; create a new Core/API instance for a new lifecycle.

## Capabilities

`api.capabilities` is a read-only set of booleans resolved from the services bound when the API is created. `api.meta.getCapabilities()` returns a detached object snapshot of the same capability values.

| Flag | Enables |
| --- | --- |
| `patch` | `rows.patch` for row-ID keyed client updates. |
| `externalUpdate` | `rows.applyExternalUpdates` for external/cache-originated updates. |
| `dataMutation` | Source data replacement/insertion operations exposed by `rows`. |
| `backpressureControl` | `data.pause`, `resume`, and `flush`. |
| `compute` | Compute-mode queries and switching. |
| `selection` | Cell/range selection operations. |
| `rowSelection` | Record selection and focused-row operations. |
| `columnSelection` | Whole-column selection by stable key. |
| `transaction` | Transaction history operations. |
| `histogram` | `columns.getHistogram`. |
| `sortFilterBatch` | One batched sort/filter model update. Without it, `setSortAndFilterModel` falls back to sequential model calls. |
| `viewportPosition` | Semantic viewport-position snapshot and restore. |

The API namespaces remain present when optional capabilities are absent. Prefer a namespace's `hasSupport()` where one exists, or check the matching flag. Unsupported mutations throw instead of silently claiming success; some optional reads return `null`, `false`, or empty values.

## Compute and projection policy

| Method | Contract |
| --- | --- |
| `compute.hasSupport()` | Reports whether compute-mode control is available. |
| `compute.getMode()` | Returns the current compute mode, or `null` when unsupported. |
| `compute.switchMode(mode)` | Requests a mode change and returns whether the mode changed. Unsupported calls throw. It does not implicitly recompute rows. |
| `compute.getDiagnostics()` | Returns compute diagnostics or `null`; this is a read, not a recompute request. |
| `policy.getProjectionMode()` | Returns the active projection mutation policy (`mutable`, `immutable`, or `excel-like`). |
| `policy.setProjectionMode(mode)` | Sets the policy and returns the mode applied by the runtime. In immutable mode, row mutation paths that would modify projection state reject. |

## Diagnostics and metadata

| Method | Contract |
| --- | --- |
| `diagnostics.getAll()` | Returns read-only snapshots for row model, projection/cache, compute, and datasource backpressure diagnostics. Does not trigger projection recomputation. |
| `diagnostics.getFormulaExplain()` | Returns the current formula execution plan and available per-formula explain diagnostics. Missing formula diagnostics are represented as `null` or omitted optional fields. |
| `meta.getSchema()` | Returns row-model kind and column key/label/visibility/pin/width metadata. It includes metadata keys, not arbitrary metadata values. |
| `meta.getRowModelKind()` | Returns the current model kind identifier. |
| `meta.getApiVersion()` | Returns the compatibility version of the public API. |
| `meta.getProtocolVersion()` | Returns the data/protocol compatibility version. |
| `meta.getCapabilities()` | Returns a detached capability snapshot. |
| `meta.getRuntimeInfo()` | Returns compact runtime status including lifecycle, model kind, row count, revisions/loading, viewport range, projection policy, and compute mode. |

Use metadata for integration checks and diagnostics, not as a replacement for row/column snapshots. Schema metadata intentionally avoids serializing arbitrary column metadata values.
