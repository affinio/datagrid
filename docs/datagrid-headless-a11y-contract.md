# DataGrid Headless A11y Contract

Updated: `2026-02-08`

`@affino/datagrid-core` now includes a deterministic headless accessibility state machine for keyboard, focus, and ARIA state.

Import path:
- `@affino/datagrid-core/advanced`

## Core Contract

Source:
- `packages/datagrid-core/src/a11y/headlessA11yStateMachine.ts`

Public API:
- `createDataGridA11yStateMachine(...)`
- `DataGridA11yStateMachine`
- `DataGridA11ySnapshot`
- `DataGridA11yKeyboardCommand`
- `DataGridA11yGridAriaState`
- `DataGridA11yCellAriaState`

State machine guarantees:
- same command sequence => same snapshot (`deterministic`)
- roving tabindex contract (`active cell = 0`, others `-1`)
- stable `aria-activedescendant` derived from focused cell
- clamped focus after resize (`setDimensions`) with fail-safe blur for empty grids

Keyboard contract includes:
- arrows
- `Home` / `End` (with `ctrl/meta` row jump semantics)
- `PageUp` / `PageDown` (configurable page step)
- `Tab` / `Shift+Tab`
- `Escape` blur semantics

## Adapter Mapping Contract (Vue)

Source:
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts`

Mapping helpers:
- `mapDataGridA11yGridAttributes(...)`
- `mapDataGridA11yCellAttributes(...)`

These convert headless A11y state to DOM-ready attributes:
- grid: `role`, `tabindex`, `aria-rowcount`, `aria-colcount`, `aria-activedescendant`
- cell: `id`, `role`, `tabindex`, `aria-rowindex`, `aria-colindex`, `aria-selected`

## Contract Tests

- Core state machine:
  - `packages/datagrid-core/src/a11y/__tests__/headlessA11yStateMachine.contract.spec.ts`
- Vue adapter DOM mapping:
  - `packages/datagrid-vue/src/adapters/__tests__/a11yAttributesAdapter.contract.spec.ts`
