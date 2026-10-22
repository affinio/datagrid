# Vue app package ownership

Status: implemented.

The supported Vue component package is `@affino/datagrid-vue`. It contains the
headless Vue adapter and app-facing grid on separate package entrypoints. Import
`DataGrid` from the package root; use `@affino/datagrid-vue/headless` when an
application owns rendering or runtime composition.

## Feature ownership

- App rendering, diagnostics UI, formula runtime controls, and performance
  presets live in `packages/datagrid-vue/src/app-layer`.
- Formula parsing, compilation, runtime contracts, and reusable function packs
  live in `@affino/datagrid-formula-engine`.
- Framework-neutral runtime and interaction contracts remain in core and
  orchestration packages.
- Applications provide workload-specific settings and formula functions through
  the public props and APIs.

The former `*-enterprise` packages and license checks have been removed. These
capabilities ship through the ordinary package APIs and do not need a separate
package or license key.
