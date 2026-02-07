# UiTable Component Documentation

**Version**: 1.0  
**Type**: Vue 3 Component  
**License**: Proprietary

---

## Table of Contents

- [English Documentation](#english-documentation)
  - [Overview](#overview)
  - [Features](#features)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
  - [Props API](#props-api)
  - [Events API](#events-api)
  - [Column Configuration](#column-configuration)
  - [Selection & Navigation](#selection--navigation)
  - [Editing & Validation](#editing--validation)
  - [Filtering & Sorting](#filtering--sorting)
  - [Clipboard Operations](#clipboard-operations)
  - [Advanced Features](#advanced-features)
  - [Exposed Methods](#exposed-methods)
  - [Slots](#slots)
  - [Styling & Theming](#styling--theming)
  - [Performance Considerations](#performance-considerations)
  - [Accessibility](#accessibility)

---

## English Documentation

### Overview

**UiTable** is a high-performance, feature-rich data grid component for Vue 3 applications. It provides spreadsheet-like functionality with virtual scrolling, inline editing, advanced filtering, multi-column sorting, keyboard navigation, clipboard support, and full accessibility compliance.

**Key Characteristics:**
- Virtual scrolling for efficient rendering of large datasets (100k+ rows)
- Inline cell editing with validation
- Excel-like keyboard shortcuts and navigation
- Multi-range selection with visual feedback
- Copy/paste support with clipboard integration
- Column filtering (set-based and advanced conditions)
- Multi-column sorting with priority indicators
- Undo/redo history
- Customizable cell renderers via slots
- Full ARIA support for screen readers
- Dark mode compatible
- Responsive zoom controls

---

### Directory Layout

The Vue layer is organised so each concern is easy to discover:

- `components/` — all `.vue` single-file components, including the public `UiTable.vue` and the internal building blocks (toolbar, status bar, modals, etc.)
- `composables/` — composition utilities that encapsulate table behaviour such as filtering, clipboard support, and virtualization
- `core/` — framework-agnostic helpers (column math, selection model, virtualization primitives)
- `imperative/` — imperative controllers that manage low-level DOM interactions
- `styles/` — CSS modules applied by `UiTable.vue`
- `types/` — shared TypeScript definitions consumed by both runtime code and consumers
- `utils/` — lightweight helpers (DOM measurements, column storage, validators)

Use `src/ui-table/vue/components/index.ts` for named exports when you need direct access to a specific building block; the main `src/ui-table/index.ts` barrel continues to expose the public surface (`UiTable`, types, themes, plugins, etc.).

---

### Features

#### Core Features
- ✅ **Virtual Scrolling** - Renders only visible rows for optimal performance
- ✅ **Inline Editing** - Text, number, and select editors with validation
- ✅ **Selection** - Single cell, range, row, and column selection
- ✅ **Keyboard Navigation** - Arrow keys, Tab, Enter, Page Up/Down, Home/End
- ✅ **Clipboard** - Copy/paste with Excel compatibility
- ✅ **Filtering** - Set-based filters and advanced condition builder
- ✅ **Sorting** - Single and multi-column sorting
- ✅ **Undo/Redo** - Full edit history with Cmd+Z/Cmd+Shift+Z
- ✅ **Fill Handle** - Excel-like drag-to-fill functionality
- ✅ **Column Resizing** - Drag column borders to resize
- ✅ **Column Visibility** - Show/hide columns with persistence
- ✅ **Summary Row** - Display aggregated data at the bottom
- ✅ **Dark Mode** - Automatic theme switching
- ✅ **Accessibility** - WCAG 2.1 AA compliant with ARIA support

#### Advanced Features
- Auto-scroll during drag selection
- Visual flash feedback for paste, copy, fill, undo/redo operations
- Sticky headers and index column
- Zoom controls (50% - 200%)
- Custom cell renderers via slots
- Row and column context menus
- Validation errors with visual indicators
- Configurable row height modes (fixed/auto)
- CSV import/export
- localStorage persistence for column widths, visibility, sort, and zoom

---

### Installation

```bash
# The component is already part of your project
# No additional installation required
```

**Import in your component:**

```vue
<script setup lang="ts">
import { UiTable } from '@/ui-table'
import type { UiTableColumn } from '@/ui-table'
</script>
```

---

### Basic Usage

```vue
<template>
  <UiTable
    :rows="tableData"
    :columns="tableColumns"
  table-id="my-data-table"
    @cell-edit="handleCellEdit"
    @selection-change="handleSelectionChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiTable } from '@/ui-table'
import type { UiTableColumn, CellEditEvent } from '@/ui-table'

const tableData = ref([
  { id: 1, name: 'John Doe', age: 30, email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', age: 25, email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', age: 35, email: 'bob@example.com' },
])

const tableColumns = ref<UiTableColumn[]>([
  {
    key: 'id',
    label: 'ID',
    width: 80,
    editable: false,
    sortable: true,
  },
  {
    key: 'name',
    label: 'Name',
    width: 200,
    editor: 'text',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'age',
    label: 'Age',
    width: 100,
    editor: 'number',
    sortable: true,
    filterType: 'number',
  },
  {
    key: 'email',
    label: 'Email',
    width: 250,
    editor: 'text',
    sortable: true,
    filterType: 'text',
  },
])

function handleCellEdit(event: CellEditEvent) {
  const { rowIndex, key, value } = event
  tableData.value[rowIndex][key as keyof typeof tableData.value[0]] = value
  console.log('Cell edited:', event)
}

function handleSelectionChange(snapshot: any) {
  console.log('Selection changed:', snapshot)
}
</script>
```

---

### Structured Configuration (`UiTableConfig`)

UiTable now supports a consolidated `config` prop that groups public options into a scalable shape. Legacy top-level props remain available and will override matching config values, but new implementations should favor the structured API for clarity and future compatibility.

```ts
import type { UiTableConfig } from '@/ui-table'

const tableConfig: UiTableConfig = {
  data: {
    rows: tableData.value,
    totalRows: 120,
    summaryRow: summaryTotals.value,
  },
  columns: {
    definitions: tableColumns.value,
  },
  features: {
    selection: { enabled: true, mode: 'row', showSelectionColumn: true },
    hoverable: true,
    rowIndexColumn: true,
  },
  appearance: {
    rowHeightMode: 'auto',
    styleConfig: customStyles,
  },
  load: {
    lazyLoader: loadNextPage,
    autoLoadOnScroll: true,
  },
  debug: { viewport: import.meta.env.DEV },
  events: {
    selectionChange: handleSelectionChange,
    reachBottom: () => loadNextPage('scroll'),
  },
}

// Template usage
// <UiTable :config="tableConfig" />
```

You can also pass an `events` prop; its callbacks are merged with `config.events` and executed alongside Vue's `@event` listeners.

#### `UiTableConfig` Sections

| Section | Keys | Notes |
|---------|------|-------|
| `data` | `rows`, `totalRows`, `summaryRow` | Primary dataset, record count for pagination, and optional summary/footer data |
| `columns` | `definitions`, `groups` | Column definitions and optional grouped column metadata |
| `features` | `inlineControls`, `hoverable`, `rowIndexColumn`, `zoom`, `selection.*` | Feature toggles; `selection` supports `enabled`, `mode`, `showSelectionColumn`, `selected` |
| `appearance` | `rowHeightMode`, `rowHeight`, `styleConfig` | Layout sizing and theme tokens |
| `load` | `hasMore`, `pageSize`, `autoLoadOnScroll`, `loadOnMount`, `lazyLoader`, `serverSideModel`, `filterOptionLoader` | Infinite scrolling and server-driven data hooks |
| `debug` | `viewport` | Enables debug overlays |
| `selection` | Same as `features.selection` | Shorthand override merged into `features.selection` |
| `events` | see [Events API](#events-api) | Inline event callbacks merged with the `events` prop |
| `experimental` | — | Reserved for future feature flags |
| `state` | `selected`, `loading` | Controlled state inputs for selection and loading indicators |

---

### Props API

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `config` | `UiTableConfig` | `{}` | ❌ | Preferred structured configuration object |
| `events` | `UiTableEventHandlers` | `{}` | ❌ | Event handler map (merged with `config.events`) |
| `rows` | `any[]` | - | ❌* | Legacy inline data array (overrides `config.data.rows`) |
| `columns` | `UiTableColumn[]` | - | ❌* | Legacy column list (overrides `config.columns.definitions`) |
| `tableId` | `string` | `'default'` | ❌ | Storage namespace; overrides `config.tableId` |
| `totalRows` | `number` | - | ❌ | Overrides `config.data.totalRows` |
| `loading` | `boolean` | `false` | ❌ | Overrides `config.state.loading` |
| `rowHeightMode` | `'fixed' \| 'auto'` | `'fixed'` | ❌ | Overrides `config.appearance.rowHeightMode` |
| `summaryRow` | `Record<string, any>` | `null` | ❌ | Overrides `config.data.summaryRow` |
| `debugViewport` | `boolean` | `false` | ❌ | Overrides `config.debug.viewport` |
| `inlineControls` | `boolean` | `true` | ❌ | Overrides `config.features.inlineControls` |


\* Required when the corresponding value is not supplied via `config`.

> ℹ️ Virtualization is always enabled. The old `virtualization` toggle and imperative rendering mode were removed.

---

### Events API

All events continue to emit through Vue listeners (for example, `@cell-edit`, `@selection-change`). The same callbacks can be registered declaratively via the `events` prop or `config.events` using the camelCase handler key shown below.

| Vue Event | Handler Key | Payload | Description |
|-----------|-------------|---------|-------------|
| `cell-edit` | `cellEdit` | `CellEditEvent` | Fired when a single cell value is edited |
| `batch-edit` | `batchEdit` | `CellEditEvent[]` | Fired when multiple cells are edited at once |
| `selection-change` | `selectionChange` | `UiTableSelectionSnapshot` | Fired when selection changes |
| `sort-change` | `sortChange` | `SortState \| null` | Fired when sort configuration changes |
| `filter-change` | `filterChange` | `Record<string, string[]>` | Fired when filters are applied or cleared |
| `filters-reset` | `filtersReset` | `void` | Fired when all filters are cleared |
| `column-resize` | `columnResize` | `{ key: string, width: number }` | Fired when a column is resized |
| `zoom-change` | `zoomChange` | `number` | Fired when zoom level changes |
| `reach-bottom` | `reachBottom` | `void` | Fired when the viewport reaches the lazy-load threshold |
| `lazy-load` | `lazyLoad` | `UiTableLazyLoadContext` | Fired just before invoking the lazy loader |
| `lazy-load-complete` | `lazyLoadComplete` | `UiTableLazyLoadContext` | Fired after the lazy loader resolves |
| `lazy-load-error` | `lazyLoadError` | `UiTableLazyLoadContext & { error: unknown }` | Fired when the lazy loader throws |
| `rows-delete` | `rowsDelete` | `unknown` | Fired when rows are deleted via keyboard |
| `group-filter-toggle` | `groupFilterToggle` | `boolean` | Fired when the group filter panel visibility changes |
| `row-click` | `rowClick` | `{ rowIndex: number, row: any }` | Fired when a data row is clicked |

#### Event Payload Types

```typescript
interface CellEditEvent<T = any> {
  rowIndex: number           // Index in original dataset
  originalRowIndex?: number  // Same as rowIndex (explicit)
  displayRowIndex?: number   // Index in filtered/sorted view
  key: keyof T | string      // Column key
  value: unknown             // New cell value
  row?: T                    // Full row object
}

interface UiTableSelectionSnapshot {
  ranges: UiTableSelectionSnapshotRange[]
  activeRangeIndex: number
  activeCell: UiTableSelectionPoint | null
  clone(): UiTableSelectionSnapshot
}

interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

type FilterChangePayload = Record<string, string[]>

type UiTableLazyLoadReason =
  | 'mount'
  | 'scroll'
  | 'manual'
  | 'filter-change'
  | 'sort-change'
  | 'refresh'

interface UiTableLazyLoadContext {
  page: number
  pageSize: number
  offset: number
  totalLoaded: number
  reason: UiTableLazyLoadReason
  sorts?: SortState[]
  filters?: FilterChangePayload | null
}
```

---

### Column Configuration

Each column in the `columns` array can have the following properties:

```typescript
interface UiTableColumn {
  key: string                    // Unique column identifier (required)
  label: string                  // Display name (required)
  width?: number                 // Column width in pixels
  minWidth?: number              // Minimum width constraint
  maxWidth?: number              // Maximum width constraint
  resizable?: boolean            // Allow column resizing (default: true)
  sortable?: boolean             // Enable sorting (default: true)
  visible?: boolean              // Column visibility (default: true)
  editable?: boolean             // Allow cell editing (default: true)
  editor?: 'text' | 'select' | 'number' | 'none'  // Editor type
  align?: 'left' | 'center' | 'right'            // Content alignment
  headerAlign?: 'left' | 'center' | 'right'      // Header alignment
  filterType?: 'set' | 'text' | 'number' | 'date' // Filter type
  options?: Array<{label: string, value: any}>    // For select editor
  placeholder?: string           // Input placeholder text
  validator?: (value: unknown, row: any) => boolean | string  // Validation function
}
```

#### Column Configuration Examples

**Text Column with Validation:**
```typescript
{
  key: 'email',
  label: 'Email Address',
  width: 250,
  editor: 'text',
  sortable: true,
  filterType: 'text',
  validator: (value) => {
    const email = String(value || '')
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 'Invalid email format'
  }
}
```

**Select Column with Options:**
```typescript
{
  key: 'status',
  label: 'Status',
  width: 150,
  editor: 'select',
  sortable: true,
  filterType: 'set',
  options: [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Pending', value: 'pending' }
  ]
}
```

**Number Column:**
```typescript
{
  key: 'price',
  label: 'Price',
  width: 120,
  editor: 'number',
  sortable: true,
  filterType: 'number',
  align: 'right',
  validator: (value) => {
    const num = Number(value)
    return num >= 0 || 'Price must be positive'
  }
}
```

**Read-only Column:**
```typescript
{
  key: 'id',
  label: 'ID',
  width: 80,
  editable: false,
  sortable: true,
  align: 'center'
}
```

---

### Selection & Navigation

> The selection engine now lives in the headless core (`src/ui-table/core/selection`). Vue-specific DOM access is funneled through lightweight adapters in `src/ui-table/vue/imperative`, so other hosts can reuse the same fill/drag logic without pulling in Vue internals.
>
> Auto-scroll behaviour is handled by `createAutoScrollController`, which works with any environment through an adapter that knows how to read viewport bounds and scroll surfaces. The Vue composable simply wires it to DOM refs.

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Arrow Keys | Navigate between cells |
| Tab / Shift+Tab | Move to next/previous editable cell |
| Enter | Start editing or move down |
| Shift+Enter | Move up |
| Ctrl/Cmd+A | Select all cells |
| Shift+Click | Extend selection |
| Ctrl/Cmd+Click | Toggle selection |
| Home / End | Jump to row start/end |
| Ctrl/Cmd+Home/End | Jump to grid corners |
| Page Up / Down | Scroll by page |
| Ctrl/Cmd+C | Copy selection |
| Ctrl/Cmd+V | Paste from clipboard |
| Ctrl/Cmd+Z | Undo last edit |
| Ctrl/Cmd+Shift+Z | Redo last undone edit |
| Delete / Backspace | Clear selected cells |
| Esc | Cancel editing / Clear selection |

#### Programmatic Selection

```typescript
// Get component reference
const tableRef = ref<InstanceType<typeof UiTable>>()

// Select a single cell
tableRef.value?.focusCell(5, 'email')

// Set a range selection
tableRef.value?.setSelection({
  startRow: 0,
  endRow: 5,
  startCol: 0,
  endCol: 2
})

// Clear selection
tableRef.value?.clearSelection()

// Get current selection
const snapshot = tableRef.value?.getSelectionSnapshot()
```

---

### Editing & Validation

#### Editor Types

**Text Editor:**
```typescript
{ key: 'name', label: 'Name', editor: 'text' }
```
- Single-line text input
- Triggers on double-click or F2
- Commit on Enter or blur

**Number Editor:**
```typescript
{ key: 'age', label: 'Age', editor: 'number' }
```
- Numeric input with validation
- Shows numeric keyboard on mobile

**Select Editor:**
```typescript
{
  key: 'category',
  label: 'Category',
  editor: 'select',
  options: [
    { label: 'Type A', value: 'a' },
    { label: 'Type B', value: 'b' }
  ]
}
```
- Dropdown selection
- Opens immediately on activation

#### Validation

Validators return `true` for valid values or an error string:

```typescript
{
  key: 'quantity',
  label: 'Quantity',
  editor: 'number',
  validator: (value, row) => {
    const num = Number(value)
    if (!Number.isInteger(num)) return 'Must be an integer'
    if (num < 0) return 'Must be positive'
    if (num > 1000) return 'Cannot exceed 1000'
    return true
  }
}
```

Invalid cells show:
- Red border
- Error tooltip on hover
- Error icon in cell

---

### Filtering & Sorting

#### Set-Based Filtering

Click column header menu → Select/deselect values → Apply

```typescript
{
  key: 'status',
  label: 'Status',
  filterType: 'set'  // Shows checkbox list of unique values
}
```

#### Advanced Condition Filtering

Click "Filter by condition" in column menu:

**Text Conditions:**
- Contains
- Starts with
- Ends with
- Equals

**Number/Date Conditions:**
- Equals
- Greater than (>)
- Less than (<)
- Greater or equal (>=)
- Less or equal (<=)
- Between

**Multi-Clause Filters:**
- Add multiple conditions
- Combine with AND/OR logic

```typescript
{
  key: 'price',
  label: 'Price',
  filterType: 'number'  // Enables advanced number filters
}
```

#### Multi-Column Sorting

- Click column header to sort
- Shift+Click to add secondary sort
- Sort priority indicators show order
- Up to 3 levels of sorting

**Programmatic Sorting:**
```typescript
tableRef.value?.setMultiSortState([
  { columnKey: 'name', direction: 'asc', priority: 1 },
  { columnKey: 'age', direction: 'desc', priority: 2 }
])
```

---

### Clipboard Operations

#### Copy
- Select cells → Ctrl/Cmd+C
- Copies to clipboard in TSV format (Excel-compatible)
- Visual flash feedback on copy

#### Paste
- Select target cell → Ctrl/Cmd+V
- Pastes from clipboard maintaining structure
- Automatically expands to fit data
- Visual flash feedback on paste
- Creates undo history entry

#### CSV Export/Import

```typescript
const tableRef = ref<InstanceType<typeof UiTable>>()

// Export entire table to CSV
const csvData = tableRef.value?.exportCSV()
downloadFile(csvData, 'data.csv')

// Import CSV data
const csvContent = await readFile()
tableRef.value?.importCSV(csvContent)
```

---

### Advanced Features

#### Fill Handle

Excel-like drag-to-fill:
1. Select a cell or range
2. Hover over bottom-right corner
3. Drag down/across to fill
4. Double-click to auto-fill down to last row

**Auto-Fill Logic:**
- Numbers: Increment by pattern
- Text: Repeat values
- Dates: Increment by day/month/year

#### Undo/Redo

- Full edit history tracking
- Ctrl/Cmd+Z to undo
- Ctrl/Cmd+Shift+Z to redo
- Works with all edit operations (type, paste, fill, batch)
- Visual flash feedback

#### Column Visibility

Toggle columns on/off:
```typescript
// Programmatic control
tableRef.value?.openVisibilityPanel()
tableRef.value?.closeVisibilityPanel()
tableRef.value?.resetColumnVisibility()
```

Settings persist to localStorage automatically.

#### Zoom Controls

- Zoom range: 50% - 200%
- Ctrl/Cmd + Mouse Wheel to zoom
- Zoom persists per table instance

```typescript
// Programmatic zoom
tableRef.value?.setZoom(1.5)  // 150%
```

#### Summary Row

Display aggregated data:
```vue
<UiTable
  :rows="data"
  :columns="columns"
  :summary-row="{
    name: 'Total',
    quantity: totalQuantity,
    price: averagePrice
  }"
>
  <template #summary-price="{ value }">
    <strong>${{ value.toFixed(2) }}</strong>
  </template>
</UiTable>
```

---

### Exposed Methods

Access these via template ref:

```typescript
const tableRef = ref<InstanceType<typeof UiTable>>()
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `scrollToRow` | `(index: number) => void` | Scroll to specific row |
| `scrollToColumn` | `(key: string) => void` | Scroll to specific column |
| `isRowVisible` | `(index: number) => boolean` | Check if row is in viewport |
| `focusCell` | `(row: number, col: string) => void` | Focus specific cell |
| `setSelection` | `(range: SelectionRange) => void` | Set selection programmatically |
| `clearSelection` | `() => void` | Clear current selection |
| `getSelectionSnapshot` | `() => SelectionSnapshot` | Get current selection state |
| `getCellValue` | `(row: number, col: number) => any` | Get cell value |
| `setCellValue` | `(row: number, col: number, value: any) => void` | Set cell value |
| `getSelectedCells` | `() => SelectedCell[]` | Get all selected cells |
| `copySelectionToClipboard` | `() => Promise<void>` | Copy selection to clipboard |
| `pasteClipboardData` | `() => Promise<void>` | Paste from clipboard |
| `exportCSV` | `() => string` | Export table as CSV |
| `importCSV` | `(csv: string) => void` | Import CSV data |
| `undo` | `() => void` | Undo last edit |
| `redo` | `() => void` | Redo last undone edit |
| `resetColumnVisibility` | `() => void` | Show all columns |
| `openVisibilityPanel` | `() => void` | Open column visibility panel |
| `closeVisibilityPanel` | `() => void` | Close column visibility panel |

---

### Slots

#### Cell Renderer Slots

Customize cell rendering:

```vue
<UiTable :rows="data" :columns="columns">
  <template #cell-status="{ value, row, column, rowIndex, colIndex }">
    <span :class="statusClass(value)">
      {{ value }}
    </span>
  </template>

  <template #cell-avatar="{ row }">
    <img :src="row.avatarUrl" class="w-8 h-8 rounded-full" />
  </template>
</UiTable>
```

**Slot Props:**
- `value` - Current cell value
- `row` - Full row object
- `column` - Column configuration
- `rowIndex` - Row index
- `colIndex` - Column index

#### Summary Slots

Customize summary row cells:

```vue
<UiTable :rows="data" :columns="columns" :summary-row="summaryData">
  <!-- Column-specific summary -->
  <template #summary-price="{ value, column }">
    <strong>${{ value.toFixed(2) }}</strong>
  </template>

  <!-- Generic summary (fallback) -->
  <template #summary="{ value, column }">
    {{ value }}
  </template>

  <!-- Summary row label -->
  <template #summary-label>
    <strong>Totals:</strong>
  </template>
</UiTable>
```

---

### Styling & Theming

#### CSS Classes

Key classes for customization:

```css
.ui-table { /* Main container */ }
.ui-table__viewport { /* Scrollable grid */ }
.ui-table__header-row { /* Header row */ }
.ui-table-header { /* Header cells */ }
.ui-table__row-index { /* Row number column */ }
.ui-table-cell { /* Data cells */ }
.ui-table__summary-row { /* Summary row */ }
.ui-table-fill-handle { /* Fill drag handle */ }
```

#### Theme Tokens

UiTable exposes a type-safe `UiTableThemeTokens` map that drives typography, spacing, borders, and colors. Tokens are surfaced through the `styleConfig` prop (`config.appearance.styleConfig`) and converted to CSS variables at runtime. Refer to `frontend/src/ui-table/theme/industrialNeutralTheme.ts` for the complete token list.

```ts
import type { UiTableStyleConfig } from "@/ui-table"

export const industrialNeutralTheme: UiTableStyleConfig = {
  inheritThemeFromDocument: true,
  defaultTokenVariant: "light",
  tokenVariants: {
    light: { /* token overrides */ },
    dark: { /* token overrides */ },
  },
}
```

#### Using Tailwind Tokens

Tailwind projects can declare `tokenVariants` where each entry pulls from your design tokens. For example:

```ts
export const tailwindTableTheme: UiTableStyleConfig = {
  inheritThemeFromDocument: true,
  defaultTokenVariant: "light",
  documentDarkClass: "dark",
  tokenVariants: {
    light: {
      tableBackgroundColor: "theme(colors.slate.50)",
      tableTextColor: "theme(colors.slate.800)",
      rowDividerColor: "theme(colors.slate.200)",
      bodyRowHoverBackgroundColor: "theme(colors.blue.100 / 0.35)",
    },
    dark: {
      tableBackgroundColor: "theme(colors.slate.900)",
      tableTextColor: "theme(colors.slate.100)",
      rowDividerColor: "theme(colors.slate.700)",
      bodyRowHoverBackgroundColor: "theme(colors.blue.400 / 0.25)",
    },
  },
  table: {
    wrapper: "border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm",
  },
}
```

> Tip: when using PostCSS with Tailwind, `theme(...)` helpers get resolved at build time. Alternatively, define global CSS variables via `@layer base` and reference them in tokens with `var(--color-surface)`.

#### Applying a Theme

Pass the configuration via prop or `config.appearance.styleConfig`:

```vue
<script setup lang="ts">
import { computed } from "vue"
import { UiTable } from "@/ui-table"
import { tailwindTableTheme } from "@/ui-table"

const tableStyleConfig = computed(() => tailwindTableTheme)
</script>

<template>
  <UiTable
    :rows="rows"
    :columns="columns"
    :style-config="tableStyleConfig"
  />
</template>
```

To switch manually (for example, when you manage dark mode in a store), set `inheritThemeFromDocument: false` and provide `activeTokenVariant`:

```ts
const tableStyleConfig = computed(() => ({
  ...tailwindTableTheme,
  inheritThemeFromDocument: false,
  activeTokenVariant: isDark.value ? "dark" : "light",
}))
```

You can also mix token overrides with Tailwind utility classes using `table`, `header`, `body`, etc., inside `styleConfig` for fine‑grained adjustments.

---

### Performance Considerations

#### Virtual Scrolling

- Always enabled; the table automatically renders only visible rows (~30-50 at a time)
- Supports datasets with 100k+ rows
- Automatically handles scroll and resize events

#### Best Practices

1. **Unique Row Keys**: Ensure row data has stable references
2. **Column Width**: Specify `width` to avoid layout thrashing
3. **Validators**: Keep validation logic synchronous and fast
4. **Custom Renderers**: Avoid heavy computations in slot templates
5. **Large Pastes**: Consider batch edit events over individual cell edits

#### Performance Metrics

- Initial render: ~50-100ms for 10k rows
- Scroll performance: 60fps on modern hardware
- Edit latency: <16ms (single frame)
- Filter/sort: ~100-300ms for 10k rows

---

### Accessibility

Full WCAG 2.1 AA compliance:

#### Keyboard Navigation
- Complete keyboard control (no mouse required)
- Standard grid navigation patterns
- Focus management with visible indicators

#### Screen Reader Support
- ARIA grid role with proper row/cell structure
- aria-rowcount and aria-colcount for virtual scrolling
- aria-selected for selection states
- aria-invalid for validation errors
- Descriptive aria-labels for controls

#### Visual Indicators
- High contrast selection borders
- Focus rings on active elements
- Error states with color + icon
- Status messages for actions

#### Testing
```bash
# Run accessibility tests
npm run test -- UiTable.a11y.spec.ts
```

---

## License

Proprietary - Internal use only

---

## Support

For questions and issues, please contact the development team or create an issue in the project repository.

---

**Last Updated**: October 2025  
**Component Version**: 1.0  
**Framework**: Vue 3 + TypeScript
