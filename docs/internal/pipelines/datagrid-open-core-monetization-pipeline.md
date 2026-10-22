# Retired open-core package split

Status: retired on 2026-10-21 by product decision.

The proposed `*-enterprise` package split is no longer an active packaging plan.
The three packages that existed for the Vue app, diagnostics, and formula
extensions have been removed. Their usable functionality now ships from the
ordinary packages:

- App component, diagnostics UI, formula runtime options, and performance presets:
  `@affino/datagrid-vue`.
- Formula parser, compiler, reusable function packs, and formula helpers:
  `@affino/datagrid-formula-engine`.
- Framework-independent grid runtime and worker contracts: core and worker
  packages.

No license key or separate package is required for these features. Historical
enterprise audits and plans under `docs/internal/audits/202605/` and
`docs/internal/plans/202605/` record earlier investigations and should not be
read as current package or product commitments.
