# @affino/datagrid-vue Source Notes

Baseline date: `2026-02-08`

This file documents internal source layout for contributors.
Consumer-facing usage is documented in:
- `/Users/anton/Projects/affinio/packages/datagrid-vue/README.md`
- `/Users/anton/Projects/affinio/docs/datagrid-vue-stable-entrypoint.md`
- `/Users/anton/Projects/affinio/docs/datagrid-vue-advanced-entrypoint.md`

## Source Layout

- `components/` - Vue SFC runtime.
  - `index.ts` - canonical DataGrid component barrel (`DataGrid*` only).
  - `legacy.ts` - deprecated compatibility shim barrel (`Ui*`, removal after `2026-08-31`).
- `composables/` - runtime behavior orchestration used by `DataGrid.vue`.
- `features/` - advanced/power-user facades exported via `@affino/datagrid-vue/advanced`.
- `adapters/` - bridge utilities (a11y, settings, selection lifecycle).
- `core/` - adapter-local math/types helpers.
- `stores/` - Pinia stores used by advanced features.
- `types/` - stable type helpers used by public contracts.

## Public Surface Rules

- Root/stable entrypoints must stay minimal and semver-safe.
- Power-user APIs belong only to `advanced`.
- Legacy aliases remain only in compatibility shims and are not allowed in canonical barrels.

## Cleanup Policy

- Remove dead paths when they have no runtime import edges from `src`.
- Keep compatibility shims only until the declared deprecation window closes.
- Avoid adding new `Ui*` names outside compatibility files.
