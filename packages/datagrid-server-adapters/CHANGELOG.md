# @affino/datagrid-server-adapters

## Unreleased

### Patch Changes

- ## Summary

  Documented and covered the server pivot boundary: the default query codec intentionally omits pivot payloads, while `mapPullRequest` remains the raw enterprise escape hatch.

  ## User impact

  Backends without approved pivot projection keep receiving the stable base DTO, and pivot-capable integrations can explicitly map the raw DataGrid pull request into their own API.

  ## Validation
  - focused server adapter codec tests passed

- ## Summary

  Forwarded `groupExpansion` and datasource `treeData` pull context through the default server query codec when grouping is active.

  ## User impact

  Server-backed group expand/collapse triggers can now reach backends that rely on `groupExpansion` and tree pull operation metadata.

  ## Validation
  - focused server adapter codec tests passed

- ## Summary

  Hardened JSON-safe normalization for server query codec values by stripping `undefined` object fields before validating advanced filter payloads and other JSON-like filter snapshots.

  ## User impact

  Server adapters are more tolerant of optional UI snapshot fields that are present with `undefined`, while still rejecting non-JSON-safe values such as `NaN`.

  ## Migration
  - No migration required.

  ## Validation
  - codec coverage passed for `undefined` field stripping in advanced filter expressions

### Minor Changes

- ## Summary

  Added a server query codec for normalizing DataGrid pull requests into a stable backend DTO. The codec covers range, sort, filter model, quick filter, advanced filter expression, groupBy, groupExpansion, datasource tree pull context, and pagination state through `normalizeDataGridServerQuery(request, options?)`.

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
