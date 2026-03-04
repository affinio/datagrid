# DataGrid Data Source Protocol

Updated: `2026-02-10`

This document defines the canonical data-source boundary for `@affino/datagrid-core`.

Import path:
- `@affino/datagrid-core/advanced`

## Goals

- unify pull + push data flow for server-backed row models
- enforce abort-first behavior under viewport churn
- support partial invalidation without full cache resets
- expose backpressure diagnostics for runtime observability

## Protocol Surface

`DataGridDataSource<T>`:

- `pull(request)` - required demand API
- `subscribe(listener)` - optional push stream
- `invalidate(invalidation)` - optional invalidation hook

`DataGridDataSourcePullRequest`:

- `range` - demanded viewport window
- `priority` - `critical | normal | background`
- `reason` - `mount | viewport-change | refresh | sort-change | filter-change | group-change | invalidation | push-invalidation`
- `signal` - abort signal (abort-first cancellation contract)
- `sortModel`, `filterModel`, `groupBy`, `groupExpansion` - canonical model state snapshot

`DataGridDataSourcePushEvent<T>`:

- `upsert` - upsert row entries by source index
- `remove` - remove cached entries by index
- `invalidate` - invalidate `all` or explicit `range`

## Canonical Model Integration

`createDataSourceBackedRowModel` implements `DataGridRowModel` with:

- range-driven demand via `setViewportRange`
- abort-first cancellation for overlapping pulls
- cache invalidation APIs (`invalidateRange`, `invalidateAll`)
- push application and refetch-on-overlap behavior
- diagnostics via `getBackpressureDiagnostics()`

## Diagnostics Contract

`DataGridDataSourceBackpressureDiagnostics`:

- `pullRequested`
- `pullCompleted`
- `pullAborted`
- `pullDropped`
- `pullCoalesced` (identical inflight pull requests reused without extra `pull()`)
- `pullDeferred` (lower-priority pulls deferred behind higher-priority inflight request)
- `rowCacheEvicted` (cache-limit evictions; used to observe bounded-cache pressure)
- `pushApplied`
- `invalidatedRows`
- `inFlight`
- `hasPendingPull`
- `rowCacheSize`
- `rowCacheLimit`

Counters are monotonic except runtime-state fields:
- `inFlight`
- `hasPendingPull`
- `rowCacheSize`
- `rowCacheLimit`

## Testing Requirements

Contract coverage is defined in:

- `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`

Required categories:

- sustained viewport overload + abort-first validation
- partial invalidation behavior
- push stream application and invalidation-driven refetch
- bounded cache contract under long viewport churn
