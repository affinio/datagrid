# @affino/datagrid-server-adapters

## Unreleased

### Minor Changes

- ## Summary

  Added a server query codec for normalizing DataGrid pull requests into a stable backend DTO. The codec covers range, sort, filter model, quick filter, advanced filter expression, groupBy, and pagination state through `normalizeDataGridServerQuery(request, options?)`.

  `createAffinoDatasource()` now uses the normalized DTO by default for row pulls, with `queryCodec`, `mapQuery`, and raw `mapPullRequest` escape hatches for backend-specific protocols.

  ## User impact

  Production server-side DataGrid integrations can share one typed request normalization path instead of reimplementing range, sort, quick filter, column filters, advanced filters, and pagination mapping per app.

  The codec is not a SQL compiler, ORM adapter, permissions layer, or backend execution engine. Backends still own query execution and may either accept the normalized DTO, adapt it with `mapQuery`, or bypass it with `mapPullRequest`.

  ## Migration

  - Existing `createAffinoDatasource()` consumers may see normalized pull bodies by default.
  - Optional adoption:
    - call `normalizeDataGridServerQuery(request, options?)` directly in custom adapters,
    - use `queryCodec.columnIdMap` when frontend column keys differ from backend field ids,
    - use `mapQuery` to reshape the normalized DTO without losing package-level codec behavior,
    - use `mapPullRequest` to preserve a raw/custom backend request shape.
  - The sandbox server demo read path now uses the package codec instead of its local `flattenFilterModel` implementation.

  ## Validation

  - `@affino/datagrid-server-adapters` type-check, build, and codec tests passed
  - `@affino/datagrid-server-client` transport serialization tests passed without adding filter semantics
  - sandbox server datasource adapter tests passed for quick filter, advanced filter, and column filter request bodies
