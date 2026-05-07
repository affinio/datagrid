# Affino DataGrid Server Client

Framework-agnostic client utilities for server-backed DataGrid:

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

## Public API

```ts
import {
  createChangeFeedPoller,
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
