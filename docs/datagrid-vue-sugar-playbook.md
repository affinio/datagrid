# DataGrid Vue Sugar Playbook

Updated: `2026-02-11`
Package: `@affino/datagrid-vue`
Scope: junior-friendly integration through `useAffinoDataGrid`.

## Status Note (2026-02-11)

Sugar idealization and UX hardening pipelines are closed (`S1 -> S10`, `U1 -> U8`), and sugar is production-usable for practical AG/Sheets baseline workflows:

1. Cell-range engine (`cellSelection`: anchor/focus/range + bindings).
2. Range-centric clipboard/fill/move (`cellRange`: copy/cut/paste/clear + fill/move preview/apply).
3. Keyboard navigation + spreadsheet shortcuts (`features.keyboardNavigation`).
4. Pagination, column-state roundtrip, history wrappers.
5. Advanced filter helpers, tree/group controls, summary, visibility and row-height controls.

Closure source of truth: `docs/archive/datagrid/checklists/datagrid-vue-sugar-idealization-pipeline-checklist.md`.

## 1) Quick Start (60 sec)

```ts
import { ref } from "vue"
import { useAffinoDataGrid } from "@affino/datagrid-vue"
import type { DataGridColumnInput } from "@affino/datagrid-core"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC", region: "eu-west" },
  { rowId: "2", service: "billing-api", owner: "Payments", region: "us-east" },
])

const columns = ref<DataGridColumnInput[]>([
  { key: "service", label: "Service", initialState: { width: 220 } },
  { key: "owner", label: "Owner", initialState: { width: 180 } },
  { key: "region", label: "Region", initialState: { width: 140 } },
])

const grid = useAffinoDataGrid({
  rows,
  columns,
  features: {
    selection: true,
    clipboard: true,
    editing: true,
    keyboardNavigation: true,
  },
})

type Grid = ReturnType<typeof useAffinoDataGrid>
// grid is fully typed and safe to destructure.
```

Row identity contract (required):

1. Provide stable non-empty `rowId` (or `id`/`key`) for each row, or
2. Pass `features.selection.resolveRowKey(row, index)`.
3. Index-based fallback keys are intentionally disabled.

```vue
<DataGrid v-bind="grid.componentProps" />
```

## 2) Full Feature Configuration

```ts
import { ref } from "vue"
import { useAffinoDataGrid } from "@affino/datagrid-vue"
import type { DataGridAdvancedFilterExpression, DataGridColumnInput } from "@affino/datagrid-core"

const rows = ref<IncidentRow[]>(seedRows)
const columns = ref<DataGridColumnInput[]>([
  { key: "service", label: "Service", initialState: { width: 220 }, capabilities: { sortable: true, filterable: true } },
  { key: "owner", label: "Owner", initialState: { width: 180 }, capabilities: { sortable: true, filterable: true } },
  { key: "region", label: "Region", initialState: { width: 140 }, capabilities: { sortable: true, filterable: true, groupable: true } },
  { key: "severity", label: "Severity", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
  { key: "latencyMs", label: "Latency", dataType: "number", initialState: { width: 120 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true, aggregatable: true } },
])

`useAffinoDataGrid()` consumes authored columns as `DataGridColumnInput[]`.
Mutable layout state (`visible`, `pin`, `width`) belongs in `initialState` and later lives in runtime column state, not in `DataGridColumnDef`.

const grid = useAffinoDataGrid({
  rows,
  columns,
  features: {
    selection: true,
    clipboard: true,
    editing: {
      mode: "cell",
      enum: true,
    },
    filtering: {
      enabled: true,
      initialFilterModel: {
        columnFilters: {},
        advancedFilters: {},
      },
    },
    summary: {
      enabled: true,
      columns: [
        { key: "latencyMs", aggregations: ["avg", "max"] },
        { key: "owner", aggregations: ["countDistinct"] },
      ],
    },
    visibility: {
      enabled: true,
      hiddenColumnKeys: [],
    },
    tree: {
      enabled: true,
      initialGroupBy: {
        fields: ["owner"],
        expandedByDefault: true,
      },
    },
    rowHeight: {
      enabled: true,
      mode: "auto",
      base: 40,
    },
    interactions: {
      enabled: true,
      range: { enabled: true, fill: true, move: true },
    },
    headerFilters: {
      enabled: true,
      maxUniqueValues: 300,
    },
    feedback: {
      enabled: true,
      maxEvents: 120,
    },
    statusBar: {
      enabled: true,
    },
    keyboardNavigation: true,
  },
})

const noisyServicesFilter: DataGridAdvancedFilterExpression = {
  kind: "group",
  operator: "and",
  children: [
    { kind: "condition", key: "latencyMs", type: "number", operator: ">", value: 250 },
    {
      kind: "group",
      operator: "or",
      children: [
        { kind: "condition", key: "severity", type: "text", operator: "in", value: ["high", "critical"] },
        { kind: "condition", key: "region", type: "text", operator: "equals", value: "us-east" },
      ],
    },
  ],
}

grid.features.filtering.setAdvancedExpression(noisyServicesFilter)
grid.features.tree.setGroupBy({ fields: ["owner", "region"], expandedByDefault: false })
if (grid.features.rowHeight.supported.value) {
  grid.features.rowHeight.setMode("auto")
  grid.features.rowHeight.setBase(42)
  grid.features.rowHeight.measureVisible()
}

// keyboardNavigation=true enables built-in:
// Cmd/Ctrl+C/X/V, Delete/Backspace, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y
// plus arrow/home/end/page/tab/enter selection navigation.
```

## 2.1) Range Interactions + Resize Bindings (U1/U2)

```ts
// range interactions are declarative:
// features.interactions.range = { enabled, fill, move }

const fillHandle = grid.bindings.rangeHandle({
  rowIndex,
  columnKey: "owner",
  mode: "fill",
})

const moveHandle = grid.bindings.rangeHandle({
  rowIndex,
  columnKey: "owner",
  mode: "move",
})

const rangeSurface = grid.bindings.rangeSurface({
  rowIndex,
  columnKey: "owner",
})

const colResize = grid.bindings.columnResizeHandle("owner")
const rowResize = grid.bindings.rowResizeHandle(String(row.rowId))
```

Notes:

1. `rangeHandle` + `rangeSurface` remove page-local pointer lifecycle code.
2. Column/row resize includes keyboard and double-click autosize behavior.

## 2.2) Header Filters + Feedback + Status Bar + Layout Profiles (U3/U4/U7/U8)

```ts
grid.features.headerFilters.open("severity")
grid.features.headerFilters.setQuery("high")
grid.features.headerFilters.selectOnlyValue("severity", "critical")
grid.features.headerFilters.applyNumber("latencyMs", {
  operator: "between",
  value: 100,
  value2: 400,
})

const lastAction = grid.feedback?.lastAction.value ?? "Ready"
const events = grid.feedback?.events.value ?? []

const profile = grid.layoutProfiles?.capture("Incident triage")
if (profile) {
  grid.layoutProfiles?.apply(profile.id)
}

const metrics = grid.statusBar?.metrics.value
const selectedCells = metrics?.selectedCells ?? 0
const avgLatency = metrics?.getAggregate("latencyMs", "avg")
```

## 3) Pagination, Column State, History (S1)

```ts
// Pagination wrappers
grid.pagination.set({ pageSize: 100, currentPage: 0 })
grid.pagination.goToNextPage()
grid.pagination.goToLastPage()
const page = grid.pagination.snapshot.value

// Column state wrappers
const savedColumnState = grid.columnState.capture()
grid.columnState.setPin("service", "left")
grid.columnState.setWidth("owner", 240)
grid.columnState.setVisibility("severity", false)
grid.columnState.apply(savedColumnState) // roundtrip restore

// History wrappers
if (grid.history.supported.value && grid.history.canUndo.value) {
  await grid.history.undo()
}
if (grid.history.supported.value && grid.history.canRedo.value) {
  await grid.history.redo()
}
```

## 4) TreeView Integration Contract

Tree in sugar is model-driven. UI should render by `row.kind` and `row.groupMeta`.

Required rendering behavior:

1. If `row.kind === "group"`, render a toggle control and use `grid.features.tree.toggleGroup(groupKey)`.
2. Use `row.groupMeta.level` for indent.
3. Use `row.state.expanded` for chevron state.
4. For leaf rows, use normal editable/data-cell flow.

Group key source:

1. Prefer `row.groupMeta.groupKey`.
2. Fallback to `String(row.rowId ?? row.rowKey)`.

Important:

1. Do not attach toggle handlers both on cell container and toggle button.
2. If container has pointer handlers, ignore events that originate from the toggle button.

## 5) Advanced Filter Helpers (S8)

Sugar now includes `grid.features.filtering.helpers` for typed advanced filter composition.

### Typed conditions (text/number/date/set)

```ts
grid.features.filtering.helpers.setText("service", {
  operator: "contains",
  value: "api",
  mergeMode: "replace",
})

grid.features.filtering.helpers.setNumber("latencyMs", {
  operator: "between",
  value: 100,
  value2: 400,
  mergeMode: "merge-and",
})

grid.features.filtering.helpers.setDate("updatedAt", {
  operator: ">=",
  value: "2026-02-01",
  mergeMode: "merge-and",
})

grid.features.filtering.helpers.setSet("severity", ["high", "critical"], {
  operator: "in",
  valueMode: "replace",
  mergeMode: "merge-and",
})
```

### Excel-like add/remove for set values

```ts
grid.features.filtering.helpers.setSet("owner", ["NOC"], {
  valueMode: "append",
  mergeMode: "merge-and",
})

grid.features.filtering.helpers.setSet("owner", ["Legacy"], {
  valueMode: "remove",
  mergeMode: "merge-and",
})
```

### Remove one column condition from advanced expression

```ts
grid.features.filtering.helpers.clearByKey("severity")
```

### Manual AST remains available

```ts
const byLatency = grid.features.filtering.helpers.condition({
  key: "latencyMs",
  type: "number",
  operator: ">",
  value: 250,
})
const byRegion = grid.features.filtering.helpers.condition({
  key: "region",
  type: "text",
  operator: "equals",
  value: "us-east",
})
const expression = grid.features.filtering.helpers.and(byLatency, byRegion)
grid.features.filtering.helpers.apply(expression, { mergeMode: "replace" })
```

## 6) Selection Summary

`summary` is selection-scope based and uses core API internally.

```ts
const snapshot = grid.features.summary.selected.value
const avgLatency = snapshot?.columns["latencyMs"]?.aggregations.avg?.value ?? null
const ownersCount = snapshot?.columns["owner"]?.aggregations.countDistinct?.value ?? null
```

## 6.1) Context Menu Parity + Enum Editor (U5/U6)

```ts
// keyboard/pointer-open parity
grid.contextMenu.openForActiveCell?.({ zone: "cell" })
grid.contextMenu.openForHeader?.("owner")

const isDisabled = grid.contextMenu.isActionDisabled?.("paste") ?? false
const reason = grid.contextMenu.getActionDisabledReason?.("paste") ?? null
const groups = grid.contextMenu.groupedActions?.value ?? []

// enum editor contract
const enumEditor = grid.features.editing.enumEditor
const primitive = enumEditor?.primitive.value ?? "affino-listbox"
const options = enumEditor?.resolveOptions({
  row,
  rowKey: String(row.rowId),
  columnKey: "severity",
  value: row.severity,
}) ?? []
```

## 7) Column Visibility

```ts
grid.features.visibility.setColumnVisible("severity", false)
grid.features.visibility.toggleColumnVisible("region")
grid.features.visibility.setHiddenColumnKeys(["owner", "latencyMs"])
grid.features.visibility.reset()
```

## 8) Column Reorder (Drag + Keyboard)

```ts
// Works through bindings:
// - drag header A onto header B -> deterministic reorder
// - Alt+Shift+ArrowLeft/ArrowRight on focused header -> step reorder
const headerProps = grid.bindings.headerCell("owner")
```

## 8.1) Row Reorder (Client Model)

```ts
if (grid.rowReorder.supported.value && grid.rowReorder.canReorder.value) {
  await grid.rowReorder.moveByKey("row-10", "row-3", "before")
  await grid.rowReorder.moveByIndex(0, 5)
}

// Guard reason explains why reorder is blocked.
const reason = grid.rowReorder.reason.value

// Optional bindings for custom row markup:
const rowReorderProps = grid.bindings.rowReorder(row, rowIndex)
// drag-drop + Alt+Shift+ArrowUp/ArrowDown
```

Behavior contract:

1. Reorder is enabled only for `client` row model.
2. Reorder is blocked while group-by is active.
3. Reorder is blocked while filter model is active.
4. Every reorder is logged via transaction intent `rows-reorder`.

## 9) Interaction Contract (Minimum for parity)

Use these bindings if you build custom markup:

1. `grid.bindings.headerCell(columnKey)` for sort + header context.
2. `grid.bindings.dataCell({ row, rowIndex, columnKey, value })` for edit/context hooks.
3. `grid.bindings.inlineEditor({ rowKey, columnKey })` for commit/cancel keyboard behavior.
4. `grid.bindings.contextMenuRoot()` + `grid.bindings.contextMenuAction(actionId)` for keyboard-safe menu.
5. `grid.bindings.actionButton(actionId)` for toolbar actions.

Hotkeys users expect:

1. `Ctrl/Cmd+C`, `Ctrl/Cmd+V`, `Ctrl/Cmd+X` for clipboard flows.
2. `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` for history (when runtime transaction capability is wired).
3. `Shift+F10` for context menu.

## 10) Common Pitfalls

1. Group auto-expand after collapse: check for double toggle handlers (`mousedown` + `click`).
2. Sticky headers overlap issues: keep pinned header z-index above pinned cell content.
3. Selection drift after layout jumps: keep controls area height stable; avoid reflow pushing viewport while dragging.
4. If runtime state seems stale, call `grid.api.view.reapply()`.

## 11) References

1. `packages/datagrid-vue/README.md`
2. `docs/datagrid-vue-adapter-integration.md`
3. `docs/datagrid-sheets-user-interactions-and-integrator-api.md`

## 12) API Tier Guide

Use this to choose the right layer:

1. `useAffinoDataGridMinimal` (minimal sugar): stable baseline for fast setup without advanced UX layers.
2. `useAffinoDataGrid` (sugar): full sugar API including advanced UX, events hub, layouts, history, range/clipboard, and context menu.
3. `@affino/datagrid-orchestration` (advanced): custom UX flows, framework-specific shells, controlled complexity.
4. Internal demo patterns (internal): experimental or parity-tracking logic; not semver-stable surface.

### Minimal vs full sugar

Use `useAffinoDataGridMinimal` when you want a small, stable surface and do not need the advanced UX bundles.

```ts
import { useAffinoDataGridMinimal } from "@affino/datagrid-vue"

const grid = useAffinoDataGridMinimal({
  rows,
  columns,
  features: {
    selection: { enabled: true },
    sorting: { enabled: true },
    filtering: { enabled: true },
  },
})
```

Use `useAffinoDataGrid` when you need advanced UX layers:

- event hub (`grid.events`)
- history (`grid.history`)
- range + clipboard (`grid.cellRange`)
- layouts (`grid.layoutProfiles`)
- status bar (`grid.statusBar`)
- context menu orchestration (`grid.contextMenu`)

```ts
import { useAffinoDataGrid } from "@affino/datagrid-vue"

const grid = useAffinoDataGrid({ rows, columns })
```
