# DataGrid styling

This guide covers the built-in `DataGrid` renderer from
`@affino/datagrid-vue`.

## Start with the built-in choices

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  theme="industrial-neutral"
  :chrome="{ toolbarPlacement: 'integrated', density: 'compact' }"
/>
```

Use `theme` for colors and typography. Use `chrome` for toolbar placement and
density. Use the application around the grid for page background and outer
spacing. The DataGrid root is transparent; the table stage paints its own
surface. With an integrated toolbar, controls and table share one bordered
surface. A surrounding card adds another application surface. Keep that wrapper for page context such as controls or summaries; for a grid-only wrapper, leave the surface to DataGrid.

## Row-index width

Set `index-column-style` to customize the row-index column. Its `width` may be
`"auto"`; the built-in renderer sizes it for the number of digits in the
projected row count with a 32px minimum. The default fixed width remains 72px:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :index-column-style="{ width: 'auto' }"
/>
```

## Override theme colors

Pass a partial token object for a few color changes:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :theme="{
    gridAccentStrong: '#b45309',
    gridHeaderCellBackgroundColor: '#f4e8d5',
    pinnedRightBackgroundColor: '#fff7e8',
  }"
/>
```

Or pass a style config when document theme inheritance or explicit variants are
needed. Config `tokens` override inherited preset values in each inherited
variant. Values in the config's own `tokenVariants` override its base `tokens`
for that variant. Flat token objects override the resolved variant directly.

Useful background roles are `gridBackgroundColor` for the stage surface,
`gridViewportBackground` for the body viewport, `bodyRowBackgroundColor` for
rows, and `bodyRowSelectedBackgroundColor` for checkbox-selected and focused
rows. The built-in presets define selected-row colors for both light and dark
variants. For an application-owned palette, set this token per variant through
the public `theme` prop:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :theme="{
    tokenVariants: {
      light: { bodyRowSelectedBackgroundColor: 'var(--color-surface-selection)' },
      dark: { bodyRowSelectedBackgroundColor: 'var(--color-surface-selection-dark)' },
    },
  }"
/>
```

Checkbox-selected contiguous row runs also use the cell-selection outline
color and stroke width, with one shared top and bottom edge per run.

The header and pinned background tokens configure their own panes. These roles
may intentionally differ. The full token list is exported by
`@affino/datagrid-theme`; see the [complete token reference](./reference/datagrid-theme-tokens.md)
for token names and their CSS custom properties.

`gridFocusAxisBackgroundColor` (`--datagrid-focus-axis-bg`) tints the column
header and row index for the body cell that owns DOM focus. Built-in light and
dark presets supply separate values. Override this token in `theme.tokens` or
per-variant `theme.tokenVariants` to adjust the cue without changing selection
colors. The cue follows focus rather than hover or the selection anchor.
Selected index and header cells use `gridSelectionRangeBackgroundColor` for the
fill and `gridAccentStrong` for the narrow leading strip on selected row-index
cells. Selected or keyboard-focused column headers use a narrow top strip.

## Toolbar placement

- `stacked` puts toolbar controls above the table, with a gap.
- `integrated` puts controls and table in one bordered surface.
- `hidden` publishes toolbar modules for the application to place elsewhere.

When using `DataGridModuleHost` outside the grid, pass it the same `theme` and
`chrome` values as the DataGrid. It applies those values to its own CSS scope.
Prefer `integrated` when the toolbar should share the grid's surface without
duplicating these props.

Use `toolbar-layout` to place built-in items on separate rows and align them
without rebuilding their behavior. When group-by breadcrumbs are active, they
occupy the first row and the remaining toolbar actions start on the second row.
Explicit placements override those defaults. Without group-by, items not
specified keep the default order on the first row, aligned to the start:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :group-by="['region', 'owner']"
  :history="{ controls: true }"
  :toolbar-layout="{
    items: {
      groupByLevels: { row: 0, align: 'start' },
      quickFilter: { row: 1, align: 'start' },
      undo: { row: 1, align: 'end' },
      redo: { row: 1, align: 'end' },
    },
    undo: { presentation: 'icon', label: 'Undo' },
    redo: { presentation: 'icon', label: 'Redo' },
  }"
/>
```

Built-in item keys are `groupByLevels`, `undo`, `redo`, `columnLayout`,
`quickFilter`, `advancedFilter`, `findReplace`, and `aggregations`. Custom
modules can be positioned through `toolbar-layout.custom`, keyed by their
`DataGridAppToolbarModule.key`. `theme.tokens` includes `gridToolbar*` and
`gridToolbarButton*` colors for the toolbar surface and button states. For a
fully application-owned composition, keep `toolbarPlacement: 'hidden'` and
render the published modules through `DataGridModuleHost` with the same
`toolbar-layout`, `theme`, and `chrome` props.

## Surface shape

The built-in table stage defaults to an 8px radius. Set `surfaceRadius` in
theme tokens to change the stage and integrated surface together:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :theme="{ surfaceRadius: '12px' }"
/>
```

Avoid styling internal selectors such as `.grid-stage` as a package-level
contract.

For the ownership analysis and remaining work, see the
[styling ergonomics audit](./internal/audits/datagrid-styling-ergonomics-audit-2026-10-16.ru.md).
