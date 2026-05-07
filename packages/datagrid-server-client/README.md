# Affino DataGrid Server Client

Framework-agnostic client utilities for server-backed DataGrid:

- HTTP datasource client factory
- change feed polling
- invalidation normalization
- row snapshot mapping
- dataset version handling

## What It Is

This package contains reusable client-side helpers for talking to a server-backed DataGrid datasource. It sits between a framework adapter and a server contract without depending on Vue, a demo implementation, or a backend runtime.

## What It Is Not

- not a backend package
- not tied to Vue
- not tied to the server-demo adapter

## Installation

```bash
pnpm add @affino/datagrid-server-client
```

## Core Concepts

### Dataset Version

Use `normalizeDatasetVersion()` when the server may return a revision or version in either string or number form. The helper normalizes the value to a non-negative integer or returns `null` when the input is unusable.

### Change Feed Poller

Use `createChangeFeedPoller()` to manage polling lifecycle concerns:

- start and stop polling
- prevent overlapping requests
- abort in-flight requests on stop
- emit lightweight diagnostics
- reset on invalid since-version responses

### Row Snapshots

Use `normalizeRowSnapshots()` to normalize raw row payloads or row-entry payloads into `DataGridDataSourceRowEntry` values.

### Invalidation

Use `normalizeDatasourceInvalidation()` to convert server invalidation payloads into `DataGridDataSourceInvalidation` values.

### HTTP Client Factory

Use `createServerDatasourceHttpClient()` when you want a reusable `DataGridDataSource`-shaped client with server-backed pull, change-feed polling, row snapshot application, and diagnostics.

## Public API

```ts
import {
  createChangeFeedPoller,
  createServerDatasourceHttpClient,
  mapServerChangeEvent,
  normalizeDatasetVersion,
  normalizeDatasourceInvalidation,
  normalizeRowSnapshots,
} from "@affino/datagrid-server-client"
```

Types:

- `ServerDatasourceChangeFeedDiagnostics`
- `ServerDatasourceChangeFeedPoller`
- `ServerDatasourceChangeFeedPollerOptions`
- `ServerRowSnapshotLike`
- `ServerChangeEventLike`
- `ServerChangeMappingResult`
- `ServerDatasourceHttpClientOptions`

## Usage

### 1. Polling change feed

```ts
const poller = createChangeFeedPoller({
  getSinceVersion: () => lastSeenVersion,
  loadSinceVersion: fetchChanges,
  onResponse: handleChanges,
})

poller.start()
```

### 2. Mapping change events

```ts
const result = mapServerChangeEvent(change, normalizeDatasourceInvalidation)

if (result.kind === "upsert") {
  // apply rows
} else {
  // apply invalidation
}
```

### 3. Row snapshot normalization

```ts
const rows = normalizeRowSnapshots(serverRows)
```

### 4. Creating a server datasource client

```ts
const client = createServerDatasourceHttpClient({
  endpoints: {
    pull: "/api/pull",
    histogram: "/api/histogram",
    commitEdits: "/api/edits",
    resolveFillBoundary: "/api/fill-boundary",
    commitFillOperation: "/api/fill/commit",
    undoOperation: operationId => `/api/operations/${operationId}/undo`,
    redoOperation: operationId => `/api/operations/${operationId}/redo`,
    historyStatus: "/api/history/status",
    changesSinceVersion: sinceVersion => `/api/changes?sinceVersion=${sinceVersion}`,
  },
  mapPullResponse: response => ({
    rows: response.rows,
    total: response.total,
    revision: response.revision ?? null,
    datasetVersion: response.datasetVersion ?? null,
  }),
})

client.startChangeFeedPolling()
```

## Design Principles

- transport-agnostic
- deterministic updates
- no silent partial mutations
- fail-closed behavior

## Status

Experimental, pre-1.0.

## Boundary Notes

- Keep demo-specific filter, fill, edit, and history request shaping in the sandbox adapter.
- Keep HTTP transport helpers internal to the package.
- Use `@affino/datagrid-core` for shared datasource contracts and row-model types.
