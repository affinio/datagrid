# `@affino/datagrid-diagnostics-enterprise`

Enterprise diagnostics and profiler layers for Affino DataGrid.

## Role

This package is reserved for premium diagnostics surface such as:

- right-side projection / runtime inspector panels
- explain / trace tooling
- profiler views and performance health snapshots
- premium diagnostics adapters consumed by the enterprise app facade

This package is intended to support
[`@affino/datagrid-vue-app-enterprise`](../datagrid-vue-app-enterprise/README.md),
not to become the main user-facing package on its own.

## Boundary

`@affino/datagrid-diagnostics-enterprise` may depend on community packages.

Community packages must never depend on it.
