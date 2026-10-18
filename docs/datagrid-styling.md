# DataGrid styling

This guide covers the built-in `DataGrid` renderer from
`@affino/datagrid-vue-app`.

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
rows, and the header and pinned background tokens for those panes. These roles
may intentionally differ. The full token list is exported by
`@affino/datagrid-theme`.

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
