<template>
  <article ref="cardRootRef" class="card affino-datagrid-app-root spreadsheet-card">
    <header class="card__header spreadsheet-card__header">
      <div class="card__title-row">
        <h2>Vue: Spreadsheet Workbook</h2>
        <div class="mode-badge">Spreadsheet</div>
      </div>

      <div class="spreadsheet-toolbar">
        <div class="spreadsheet-tabs" role="tablist" aria-label="Workbook sheets">
          <button
            v-for="sheet in workbookSnapshot.sheets"
            :key="sheet.id"
            type="button"
            class="spreadsheet-tab"
            :class="{ 'spreadsheet-tab--active': sheet.id === workbookSnapshot.activeSheetId }"
            :aria-pressed="sheet.id === workbookSnapshot.activeSheetId"
            @click="openSheet(sheet.id)"
          >
            <span class="spreadsheet-tab__name">{{ sheet.name }}</span>
            <span class="spreadsheet-tab__meta">{{ sheet.formulaCellCount }} fx</span>
          </button>
        </div>

        <div class="spreadsheet-style-actions">
          <button type="button" class="spreadsheet-action" @click="applyStylePreset('ocean')">
            Accent
          </button>
          <button type="button" class="spreadsheet-action" @click="applyStylePreset('mint')">
            Success
          </button>
          <button type="button" class="spreadsheet-action" @click="applyStylePreset('amber')">
            Highlight
          </button>
          <button type="button" class="spreadsheet-action" @click="clearSelectedStyles">
            Clear style
          </button>
          <button type="button" class="spreadsheet-action" @click="copyStyleFromActiveCell">
            Copy style
          </button>
          <button
            type="button"
            class="spreadsheet-action"
            :disabled="copiedStyle == null"
            @click="pasteStyleToSelection"
          >
            Paste style
          </button>
        </div>
      </div>

      <div class="spreadsheet-formula-shell" :class="{ 'spreadsheet-formula-shell--focused': isFormulaBarFocused }">
        <div class="spreadsheet-formula-address">
          {{ activeCellBadge }}
        </div>

        <div class="spreadsheet-formula-main">
          <textarea
            ref="formulaInputRef"
            class="spreadsheet-formula-input"
            :value="editorSnapshot.rawInput"
            spellcheck="false"
            placeholder="Type a value or formula. Try = [qty]@row * [price]@row and click cells."
            @focus="handleFormulaFocus"
            @blur="handleFormulaBlur"
            @input="handleFormulaInput"
            @select="syncFormulaSelectionFromDom"
            @click="syncFormulaSelectionFromDom"
            @keyup="syncFormulaSelectionFromDom"
            @keydown="handleFormulaKeydown"
          />

          <div class="spreadsheet-formula-preview" aria-hidden="true">
            <template v-for="segment in formulaPreviewSegments" :key="segment.key">
              <span
                v-if="segment.kind === 'reference'"
                class="spreadsheet-formula-token spreadsheet-formula-token--reference"
                :class="{ 'spreadsheet-formula-token--active': segment.active }"
                :style="segment.style"
              >
                {{ segment.text }}
              </span>
              <span v-else class="spreadsheet-formula-token">{{ segment.text }}</span>
            </template>
          </div>
        </div>

        <div class="spreadsheet-formula-state">
          <div class="spreadsheet-formula-value">
            <span class="spreadsheet-formula-state__label">Display</span>
            <span>{{ activeCellDisplayLabel }}</span>
          </div>
          <div class="spreadsheet-formula-value">
            <span class="spreadsheet-formula-state__label">Refs</span>
            <span>{{ editorSnapshot.analysis.references.length }}</span>
          </div>
          <div
            v-if="activeDiagnosticMessage"
            class="spreadsheet-formula-error"
            :title="activeDiagnosticMessage"
          >
            {{ activeDiagnosticMessage }}
          </div>
        </div>
      </div>

      <div class="meta">
        <span>Workbook sheets: {{ workbookSnapshot.sheets.length }}</span>
        <span>Active rows: {{ activeSheetStats?.rowCount ?? 0 }}</span>
        <span>Columns: {{ activeSheetStats?.columnCount ?? 0 }}</span>
        <span>Formulas: {{ activeSheetStats?.formulaCellCount ?? 0 }}</span>
        <span>Errors: {{ activeSheetStats?.errorCellCount ?? 0 }}</span>
      </div>

      <div class="meta">
        <span>Sync passes: {{ workbookSnapshot.sync.passCount }}</span>
        <span>Converged: {{ workbookSnapshot.sync.converged ? "yes" : "no" }}</span>
        <span>Style clipboard: {{ copiedStyle == null ? "empty" : "ready" }}</span>
        <span>Editor mode: {{ editorSnapshot.analysis.kind }}</span>
      </div>
    </header>

    <section class="spreadsheet-layout">
      <aside class="spreadsheet-sidebar">
        <section class="spreadsheet-panel">
          <h3>Workbook demo</h3>
          <p>
            <strong>Summary</strong> now leads with direct cross-sheet refs like
            <code>=orders![total]1 + orders![total]2</code>.
          </p>
          <p>
            <strong>Orders</strong> still uses Smartsheet-style row refs like
            <code>=[qty]@row * [price]@row</code>.
          </p>
          <p>
            <strong>Customers</strong> still needs
            <code>ROLLUP('orders', ...)</code>.
          </p>
          <p>
            Workbook-wide aggregates stay on
            <code>TABLE('orders', 'total')</code>, because direct refs do not replace dynamic table scans.
          </p>
        </section>

        <section class="spreadsheet-panel">
          <h3>Reference map</h3>
          <div v-if="referenceLegend.length === 0" class="spreadsheet-empty-state">
            No parsed cell refs for the current input.
          </div>
          <div v-else class="spreadsheet-reference-list">
            <button
              v-for="reference in referenceLegend"
              :key="reference.key"
              type="button"
              class="spreadsheet-reference-chip"
              :class="{ 'spreadsheet-reference-chip--active': reference.active }"
              :style="reference.style"
              @click="moveCaretToReference(reference.key)"
            >
              <span>{{ reference.text }}</span>
              <span>{{ reference.targetsLabel }}</span>
            </button>
          </div>
        </section>

        <section class="spreadsheet-panel">
          <h3>Selected range</h3>
          <div class="spreadsheet-selection-summary">
            {{ selectedRangeLabel }}
          </div>
          <div class="spreadsheet-selection-hint">
            While the formula bar is focused, clicking another cell inserts a reference instead of changing the edited cell.
          </div>
        </section>
      </aside>

      <section
        class="grid-host spreadsheet-grid-host"
        @mousedown.capture="handleGridPointerDownCapture"
      >
        <DataGridTableStageLoose v-bind="tableStagePropsForView" />
      </section>
    </section>

    <footer class="card__footer">
      Spreadsheet shell on top of <code>datagrid-vue-app</code> stage +
      <code>datagrid-core</code> workbook/sheet/editor models.
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import {
  createDataGridSpreadsheetFormulaEditorModel,
  createDataGridSpreadsheetWorkbookModel,
  type DataGridColumnInput,
  type DataGridRowId,
  type DataGridSelectionSnapshot,
  type DataGridSpreadsheetCellAddress,
  type DataGridSpreadsheetCellSnapshot,
  type DataGridSpreadsheetStyle,
  type DataGridSpreadsheetWorkbookModel,
  type DataGridSpreadsheetWorkbookSheetHandle,
} from "@affino/datagrid-core"
import { createGridSelectionRange, type GridSelectionContext, type GridSelectionPointLike } from "@affino/datagrid-core/advanced"
import {
  useDataGridAppSelection,
  useDataGridRuntime,
  type DataGridColumnSnapshot,
  type UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import { DataGridTableStage, useDataGridTableStageRuntime } from "../../../datagrid-vue-app/src/internal"

const DataGridTableStageLoose = DataGridTableStage as unknown as new () => {
  $props: Record<string, unknown>
}

type SpreadsheetGridRow = {
  id: DataGridRowId
  __rowIndex: number
  [key: string]: unknown
}

type SpreadsheetStylePresetId = "ocean" | "mint" | "amber"

type FormulaPreviewSegment =
  | {
      key: string
      kind: "plain"
      text: string
    }
  | {
      key: string
      kind: "reference"
      text: string
      active: boolean
      style: Readonly<Record<string, string>>
    }

type ReferenceLegendEntry = {
  key: string
  text: string
  active: boolean
  targetsLabel: string
  style: Readonly<Record<string, string>>
}

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
  allowSheetQualifiedReferences: true as const,
}

const REFERENCE_PALETTE = [
  {
    text: "#0f4c81",
    border: "#3b82f6",
    soft: "rgba(59, 130, 246, 0.16)",
    solid: "rgba(59, 130, 246, 0.3)",
  },
  {
    text: "#0f766e",
    border: "#14b8a6",
    soft: "rgba(20, 184, 166, 0.16)",
    solid: "rgba(20, 184, 166, 0.3)",
  },
  {
    text: "#b45309",
    border: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.18)",
    solid: "rgba(245, 158, 11, 0.32)",
  },
  {
    text: "#9333ea",
    border: "#a855f7",
    soft: "rgba(168, 85, 247, 0.18)",
    solid: "rgba(168, 85, 247, 0.32)",
  },
  {
    text: "#be123c",
    border: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.18)",
    solid: "rgba(244, 63, 94, 0.32)",
  },
  {
    text: "#166534",
    border: "#22c55e",
    soft: "rgba(34, 197, 94, 0.18)",
    solid: "rgba(34, 197, 94, 0.32)",
  },
] as const

const STYLE_PRESETS: Record<SpreadsheetStylePresetId, DataGridSpreadsheetStyle> = {
  ocean: Object.freeze({
    background: "rgba(59, 130, 246, 0.12)",
    borderColor: "#2563eb",
    color: "#1d4ed8",
    fontWeight: 600,
  }),
  mint: Object.freeze({
    background: "rgba(16, 185, 129, 0.14)",
    borderColor: "#10b981",
    color: "#047857",
    fontWeight: 600,
  }),
  amber: Object.freeze({
    background: "rgba(245, 158, 11, 0.16)",
    borderColor: "#f59e0b",
    color: "#92400e",
    fontWeight: 600,
  }),
}

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
})

const cardRootRef = ref<HTMLElement | null>(null)
const formulaInputRef = ref<HTMLTextAreaElement | null>(null)
const sandboxThemeTokens = resolveGridThemeTokens(industrialNeutralTheme)

watchEffect(() => {
  if (!cardRootRef.value) {
    return
  }
  applyGridTheme(cardRootRef.value, sandboxThemeTokens)
})

function createDemoWorkbookModel(): DataGridSpreadsheetWorkbookModel {
  const workbook = createDataGridSpreadsheetWorkbookModel({
    activeSheetId: "orders",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 255, 255, 0.78)",
          },
          columns: [
            { key: "orderId", title: "Order", style: { fontWeight: 600 } },
            { key: "customerId", title: "Customer ID", style: { textAlign: "right" } },
            { key: "item", title: "Item" },
            { key: "status", title: "Status" },
            { key: "qty", title: "Qty", style: { textAlign: "right" } },
            { key: "price", title: "Price", style: { textAlign: "right" } },
            { key: "total", title: "Total", style: { textAlign: "right", fontWeight: 600 } },
            { key: "customerName", title: "Customer", style: { color: "#1d4ed8", fontWeight: 500 } },
          ],
          rows: [
            { id: "order-1001", cells: { orderId: "SO-1001", customerId: 1, item: "Pipeline Audit", status: "Won", qty: 4, price: 420, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1002", cells: { orderId: "SO-1002", customerId: 2, item: "Growth Workshop", status: "Won", qty: 2, price: 780, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1003", cells: { orderId: "SO-1003", customerId: 3, item: "Retention Sprint", status: "Active", qty: 6, price: 185, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1004", cells: { orderId: "SO-1004", customerId: 4, item: "Quarterly Model", status: "Won", qty: 1, price: 1480, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1005", cells: { orderId: "SO-1005", customerId: 5, item: "Ops Playbook", status: "Active", qty: 3, price: 320, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1006", cells: { orderId: "SO-1006", customerId: 1, item: "Forecast Pack", status: "Won", qty: 5, price: 250, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1007", cells: { orderId: "SO-1007", customerId: 6, item: "Renewal Deck", status: "Won", qty: 2, price: 910, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1008", cells: { orderId: "SO-1008", customerId: 2, item: "Pricing Review", status: "Active", qty: 7, price: 110, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1009", cells: { orderId: "SO-1009", customerId: 4, item: "Board Memo", status: "Won", qty: 1, price: 1950, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
            { id: "order-1010", cells: { orderId: "SO-1010", customerId: 3, item: "Expansion Pack", status: "Active", qty: 8, price: 145, total: "=[qty]@row * [price]@row", customerName: "=RELATED('customers', [customerId]@row, 'id', 'name', '')" } },
          ],
        },
      },
      {
        id: "customers",
        name: "Customers",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 252, 245, 0.85)",
          },
          columns: [
            { key: "id", title: "ID", style: { textAlign: "right", fontWeight: 600 } },
            { key: "name", title: "Name" },
            { key: "region", title: "Region" },
            { key: "tier", title: "Tier" },
            { key: "ordersCount", title: "Orders", style: { textAlign: "right" } },
            { key: "totalSpend", title: "Spend", style: { textAlign: "right", fontWeight: 600 } },
          ],
          rows: [
            { id: "customer-1", cells: { id: 1, name: "Atlas Labs", region: "UK", tier: "Enterprise", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-2", cells: { id: 2, name: "Northwind", region: "US", tier: "Growth", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-3", cells: { id: 3, name: "Sundial", region: "DE", tier: "Scale", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-4", cells: { id: 4, name: "Kiteworks", region: "FR", tier: "Enterprise", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-5", cells: { id: 5, name: "Juniper House", region: "CA", tier: "SMB", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
            { id: "customer-6", cells: { id: 6, name: "Velvet Cloud", region: "UK", tier: "Scale", ordersCount: "=ROLLUP('orders', 'customerId', [id]@row, 'orderId', 'count', 0)", totalSpend: "=ROLLUP('orders', 'customerId', [id]@row, 'total', 'sum', 0)" } },
          ],
        },
      },
      {
        id: "summary",
        name: "Summary",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(245, 250, 255, 0.88)",
          },
          columns: [
            { key: "metric", title: "Metric", style: { fontWeight: 600 } },
            { key: "value", title: "Value", style: { textAlign: "right", fontWeight: 700 } },
            { key: "note", title: "Why it matters", style: { color: "#475569" } },
          ],
          rows: [
            { id: "summary-1", cells: { metric: "Orders 1 + 2", value: "=orders![total]1 + orders![total]2", note: "Direct cross-sheet absolute refs. Edit the first two Orders totals and this cell follows them." }, style: { background: "rgba(59, 130, 246, 0.08)" } },
            { id: "summary-2", cells: { metric: "Customer 1 name", value: "=customers![name]1", note: "Direct text ref across sheets without TABLE() or RELATED()." } },
            { id: "summary-3", cells: { metric: "Gross sales", value: "=SUM(TABLE('orders', 'total'))", note: "Workbook-wide aggregate still uses TABLE() because direct refs are fixed-address links." } },
            { id: "summary-4", cells: { metric: "Top customer spend", value: "=MAX(TABLE('customers', 'totalSpend'))", note: "ROLLUP output on Customers reused downstream through TABLE()." } },
          ],
        },
      },
    ],
  })
  workbook.sync()
  return workbook
}

function cloneRowData<TRow,>(row: TRow): TRow {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(row)
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

function makeLocalCellKey(rowIndex: number, columnKey: string): string {
  return `${rowIndex}\u001f${columnKey}`
}

function makeScopedCellKey(cell: DataGridSpreadsheetCellAddress | null): string {
  if (!cell) {
    return ""
  }
  return `${cell.sheetId ?? ""}\u001f${cell.rowIndex}\u001f${cell.columnKey}`
}

function areCellsEqual(
  left: DataGridSpreadsheetCellAddress | null,
  right: DataGridSpreadsheetCellAddress | null,
): boolean {
  return makeScopedCellKey(left) === makeScopedCellKey(right)
}

function resolvePalette(index: number) {
  return REFERENCE_PALETTE[index % REFERENCE_PALETTE.length] ?? REFERENCE_PALETTE[0]
}

function formatPreviewValue(value: unknown): string {
  if (value == null || value === "") {
    return "—"
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return numberFormatter.format(value)
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE"
  }
  return String(value)
}

function formatGridValue(cell: DataGridSpreadsheetCellSnapshot | null): unknown {
  if (!cell) {
    return ""
  }
  if (cell.errorValue) {
    return "#ERROR"
  }
  const value = cell.displayValue
  if (value == null) {
    return ""
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return String(value)
}

function formatCellReferenceLabel(
  sheetName: string | null | undefined,
  columnKey: string,
  rowIndex: number,
): string {
  const normalizedSheetName = String(sheetName ?? "").trim()
  return normalizedSheetName.length > 0
    ? `${normalizedSheetName} / ${columnKey} / row ${rowIndex + 1}`
    : `${columnKey} / row ${rowIndex + 1}`
}

function normalizeVisualStyle(style: DataGridSpreadsheetStyle | null | undefined): Record<string, unknown> {
  return style && typeof style === "object" ? { ...style } : {}
}

function mergeBoxShadow(...values: Array<string | undefined>): string | undefined {
  const merged = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ")
  return merged.length > 0 ? merged : undefined
}

function resolveCellVisualStyle(style: DataGridSpreadsheetStyle | null | undefined) {
  const visualStyle = normalizeVisualStyle(style)
  const background = typeof visualStyle.background === "string"
    ? visualStyle.background
    : typeof visualStyle.backgroundColor === "string"
      ? visualStyle.backgroundColor
      : undefined
  const borderColor = typeof visualStyle.borderColor === "string" ? visualStyle.borderColor : undefined
  return {
    backgroundColor: background,
    color: typeof visualStyle.color === "string" ? visualStyle.color : undefined,
    fontWeight: typeof visualStyle.fontWeight === "number" || typeof visualStyle.fontWeight === "string"
      ? visualStyle.fontWeight
      : undefined,
    fontStyle: visualStyle.italic === true
      ? "italic"
      : typeof visualStyle.fontStyle === "string"
        ? visualStyle.fontStyle
        : undefined,
    textAlign: visualStyle.textAlign === "left" || visualStyle.textAlign === "center" || visualStyle.textAlign === "right"
      ? visualStyle.textAlign
      : undefined,
    boxShadow: borderColor ? `inset 0 0 0 1px ${borderColor}` : undefined,
  }
}

function resolveColumnWidth(columnKey: string, title: string): number {
  const normalized = columnKey.toLowerCase()
  if (normalized === "qty" || normalized === "id") {
    return 88
  }
  if (normalized.endsWith("id") || normalized === "status" || normalized === "tier" || normalized === "region") {
    return 118
  }
  if (normalized === "price" || normalized === "total" || normalized === "value" || normalized === "totalspend") {
    return 132
  }
  if (normalized === "note") {
    return 320
  }
  return Math.max(132, Math.min(240, title.length * 10 + 44))
}

function resolveColumnAlignment(columnKey: string): "left" | "center" | "right" {
  const normalized = columnKey.toLowerCase()
  if (
    normalized === "qty"
    || normalized === "price"
    || normalized === "total"
    || normalized === "value"
    || normalized === "customerid"
    || normalized === "orderscount"
    || normalized === "totalspend"
    || normalized === "id"
  ) {
    return "right"
  }
  return "left"
}

const workbook = createDemoWorkbookModel()
const workbookSnapshot = shallowRef(workbook.getSnapshot())
const workbookRevision = ref(0)
const copiedStyle = ref<DataGridSpreadsheetStyle | null>(null)
const isFormulaBarFocused = ref(false)

const editorModel = createDataGridSpreadsheetFormulaEditorModel({
  outputSyntax: "smartsheet",
  referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
  resolveRowCount: cell => {
    if (!cell?.sheetId) {
      return workbook.getActiveSheet()?.sheetModel.getSnapshot().rowCount ?? 0
    }
    return workbook.getSheet(cell.sheetId)?.sheetModel.getSnapshot().rowCount ?? 0
  },
  resolveReferenceRowCount: (reference, activeCell) => {
    if (reference.sheetReference) {
      const normalizedAlias = reference.sheetReference.trim().toLowerCase()
      const targetSheet = workbook.getSheets().find(sheet => sheet.aliases.includes(normalizedAlias))
      return targetSheet?.sheetModel.getSnapshot().rowCount ?? null
    }
    if (!activeCell?.sheetId) {
      return workbook.getActiveSheet()?.sheetModel.getSnapshot().rowCount ?? 0
    }
    return workbook.getSheet(activeCell.sheetId)?.sheetModel.getSnapshot().rowCount ?? null
  },
})
const editorSnapshot = shallowRef(editorModel.getSnapshot())

let runtimeRef: Pick<UseDataGridRuntimeResult<SpreadsheetGridRow>, "api" | "columnSnapshot"> | null = null
let suppressNextSelectionSync = false
let formulaBlurTimer: number | null = null
let unsubscribeRuntimeRows = () => {}
let unsubscribeActiveSheet = () => {}
let preserveFormulaFocusFromGridPointer = false
let allowFormulaBlur = false
const activeSheetRenderRevision = ref(0)

const unsubscribeWorkbook = workbook.subscribe(snapshot => {
  workbookSnapshot.value = snapshot
  workbookRevision.value += 1
})
const unsubscribeEditor = editorModel.subscribe(snapshot => {
  editorSnapshot.value = snapshot
})

onBeforeUnmount(() => {
  if (formulaBlurTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(formulaBlurTimer)
  }
  unsubscribeRuntimeRows()
  unsubscribeActiveSheet()
  unsubscribeEditor()
  unsubscribeWorkbook()
  editorModel.dispose()
  workbook.dispose()
})

const activeSheetHandle = computed<DataGridSpreadsheetWorkbookSheetHandle | null>(() => {
  const activeSheetId = workbookSnapshot.value.activeSheetId
  if (activeSheetId) {
    return workbook.getSheet(activeSheetId)
  }
  return workbook.getSheets()[0] ?? null
})

const activeSheetStats = computed(() => {
  const activeSheetId = workbookSnapshot.value.activeSheetId
  return workbookSnapshot.value.sheets.find(sheet => sheet.id === activeSheetId) ?? null
})

watch(
  () => activeSheetHandle.value?.id ?? "",
  () => {
    unsubscribeActiveSheet()
    const handle = activeSheetHandle.value
    if (!handle) {
      return
    }
    activeSheetRenderRevision.value += 1
    unsubscribeActiveSheet = handle.sheetModel.subscribe(() => {
      activeSheetRenderRevision.value += 1
    })
  },
  { immediate: true },
)

const activeSheetView = computed(() => {
  const activeSheetRevision = activeSheetStats.value?.revision ?? 0
  const activeSheetRenderTick = activeSheetRenderRevision.value
  const handle = activeSheetHandle.value
  void activeSheetRevision
  void activeSheetRenderTick
  if (!handle) {
    return {
      rows: [] as SpreadsheetGridRow[],
      rowSnapshots: [] as ReturnType<DataGridSpreadsheetWorkbookSheetHandle["sheetModel"]["getRows"]>,
      columns: [] as ReturnType<DataGridSpreadsheetWorkbookSheetHandle["sheetModel"]["getColumns"]>,
      cellsByKey: new Map<string, DataGridSpreadsheetCellSnapshot>(),
    }
  }

  const rowSnapshots = handle.sheetModel.getRows()
  const columns = handle.sheetModel.getColumns()
  const rows: SpreadsheetGridRow[] = []
  const cellsByKey = new Map<string, DataGridSpreadsheetCellSnapshot>()

  for (const row of rowSnapshots) {
    const materializedRow: SpreadsheetGridRow = {
      id: row.id,
      __rowIndex: row.rowIndex,
    }
    for (const column of columns) {
      const cell = handle.sheetModel.getCell({
        sheetId: handle.id,
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: column.key,
      })
      if (cell) {
        cellsByKey.set(makeLocalCellKey(row.rowIndex, column.key), cell)
      }
      materializedRow[column.key] = formatGridValue(cell)
    }
    rows.push(materializedRow)
  }

  return {
    rows,
    rowSnapshots,
    columns,
    cellsByKey,
  }
})

const gridRows = computed<readonly SpreadsheetGridRow[]>(() => activeSheetView.value.rows)
const gridColumns = computed<readonly DataGridColumnInput[]>(() => {
  return activeSheetView.value.columns.map(column => {
    const align = resolveColumnAlignment(column.key)
    return {
      key: column.key,
      label: column.title,
      initialState: {
        width: resolveColumnWidth(column.key, column.title),
      },
      presentation: {
        align,
        headerAlign: align,
      },
      capabilities: {
        editable: false,
        sortable: false,
        filterable: false,
      },
    }
  })
})

const gridMode = computed(() => "base" as const)
const rowRenderMode = computed(() => "virtualization" as const)
const rowHeightMode = computed(() => "fixed" as const)
const baseRowHeight = computed(() => 34)
const columnFilterTextByKey = ref<Record<string, string>>({})
const virtualization = computed(() => ({
  rows: true,
  columns: true,
  rowOverscan: 8,
  columnOverscan: 2,
}))

const visibleColumns = computed<readonly DataGridColumnSnapshot[]>(() => runtimeRef?.columnSnapshot.value.visibleColumns ?? [])
const totalRows = computed(() => runtimeRef?.api.rows.getCount() ?? 0)

const {
  selectionSnapshot,
  selectionAnchor,
  runtimeServices,
  syncSelectionSnapshotFromRuntime,
} = useDataGridAppSelection<SpreadsheetGridRow>({
  mode: gridMode,
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
  visibleColumns,
  totalRows,
})

const runtimeBundle = useDataGridRuntime<SpreadsheetGridRow>({
  rows: gridRows,
  columns: gridColumns,
  services: runtimeServices,
  clientRowModelOptions: {
    resolveRowId: row => row.id,
  },
})

runtimeRef = runtimeBundle
const runtimeRowVersion = ref(0)
unsubscribeRuntimeRows = runtimeBundle.rowModel.subscribe(() => {
  runtimeRowVersion.value += 1
})

watch(
  gridRows,
  rows => {
    runtimeBundle.setRows(rows)
  },
  { immediate: true },
)

onMounted(() => {
  void nextTick(() => {
    workbook.sync()
    workbookSnapshot.value = workbook.getSnapshot()
    workbookRevision.value += 1
    runtimeRowVersion.value += 1
    syncEditorCellDisplay()
  })
})

const firstColumnKey = computed(() => {
  return visibleColumns.value[0]?.key ?? activeSheetView.value.columns[0]?.key ?? "metric"
})

const {
  tableStageProps,
  syncViewportFromDom,
} = useDataGridTableStageRuntime<SpreadsheetGridRow>({
  mode: gridMode,
  rows: gridRows as never,
  sourceRows: gridRows as never,
  runtime: runtimeBundle,
  rowVersion: runtimeRowVersion,
  totalRows,
  visibleColumns,
  rowRenderMode,
  rowHeightMode,
  normalizedBaseRowHeight: baseRowHeight,
  selectionSnapshot,
  selectionAnchor,
  syncSelectionSnapshotFromRuntime,
  firstColumnKey,
  columnFilterTextByKey,
  virtualization,
  toggleSortForColumn: () => {},
  sortIndicator: () => "",
  setColumnFilterText: () => {},
  applyRowHeightSettings: () => {},
  cloneRowData,
})

function resolveSelectionContext(): GridSelectionContext<DataGridRowId> {
  return {
    grid: {
      rowCount: totalRows.value,
      colCount: visibleColumns.value.length,
    },
    getRowIdByIndex: rowIndex => runtimeBundle.api.rows.get(rowIndex)?.rowId ?? null,
  }
}

function buildSelectionSnapshot(
  range: ReturnType<typeof createGridSelectionRange<DataGridRowId>>,
  activeCell: GridSelectionPointLike<DataGridRowId>,
): DataGridSelectionSnapshot {
  return {
    ranges: [
      {
        startRow: range.startRow,
        endRow: range.endRow,
        startCol: range.startCol,
        endCol: range.endCol,
        startRowId: range.startRowId ?? null,
        endRowId: range.endRowId ?? null,
        anchor: {
          rowIndex: range.anchor.rowIndex,
          colIndex: range.anchor.colIndex,
          rowId: range.anchor.rowId ?? null,
        },
        focus: {
          rowIndex: range.focus.rowIndex,
          colIndex: range.focus.colIndex,
          rowId: range.focus.rowId ?? null,
        },
      },
    ],
    activeRangeIndex: 0,
    activeCell: {
      rowIndex: activeCell.rowIndex,
      colIndex: activeCell.colIndex,
      rowId: activeCell.rowId ?? null,
    },
  }
}

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  visibleColumns.value.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

function applySingleCellSelection(cell: DataGridSpreadsheetCellAddress): void {
  const columnIndex = visibleColumnIndexByKey.value.get(cell.columnKey)
  if (columnIndex == null) {
    return
  }
  const rowNode = runtimeBundle.api.rows.get(cell.rowIndex)
  const anchor = {
    rowIndex: cell.rowIndex,
    colIndex: columnIndex,
    rowId: rowNode?.rowId ?? cell.rowId ?? null,
  }
  const range = createGridSelectionRange(anchor, anchor, resolveSelectionContext())
  runtimeBundle.api.selection.setSnapshot(buildSelectionSnapshot(range, anchor))
  syncViewportFromDom()
}

function resolveSheetHandle(sheetId: string | null | undefined): DataGridSpreadsheetWorkbookSheetHandle | null {
  if (!sheetId) {
    return activeSheetHandle.value
  }
  return workbook.getSheet(sheetId)
}

function resolveCellSnapshot(
  cell: DataGridSpreadsheetCellAddress | null,
): DataGridSpreadsheetCellSnapshot | null {
  if (!cell) {
    return null
  }
  const handle = resolveSheetHandle(cell.sheetId)
  if (!handle) {
    return null
  }
  return handle.sheetModel.getCell({
    sheetId: handle.id,
    rowId: cell.rowId ?? null,
    rowIndex: cell.rowIndex,
    columnKey: cell.columnKey,
  })
}

function focusFormulaBar(selection?: { start: number; end: number }): void {
  void nextTick(() => {
    const input = formulaInputRef.value
    if (!input) {
      return
    }
    input.focus()
    if (selection) {
      input.setSelectionRange(selection.start, selection.end)
      editorModel.setSelection(selection)
    } else {
      const caret = input.value.length
      input.setSelectionRange(caret, caret)
      editorModel.setSelection({ start: caret, end: caret })
    }
  })
}

function syncEditorCellDisplay(): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  const cell = resolveCellSnapshot(activeCell)
  if (!cell) {
    return
  }
  if (!isFormulaBarFocused.value && cell.rawInput !== editorSnapshot.value.rawInput) {
    editorModel.setInput(cell.rawInput)
  }
  editorModel.setDisplayValue(cell.displayValue)
  editorModel.setErrorValue(cell.errorValue)
}

function openEditorCell(
  cell: DataGridSpreadsheetCellAddress,
  options: {
    focus?: boolean
    draftInput?: string | null
    selectAll?: boolean
  } = {},
): void {
  const nextCell = {
    ...cell,
    sheetId: cell.sheetId ?? activeSheetHandle.value?.id ?? null,
  }
  const snapshot = resolveCellSnapshot(nextCell)
  const rawInput = options.draftInput != null ? options.draftInput : snapshot?.rawInput ?? ""
  const selection = options.selectAll
    ? { start: 0, end: rawInput.length }
    : { start: rawInput.length, end: rawInput.length }

  editorModel.start(nextCell, rawInput, {
    selection,
    displayValue: snapshot?.displayValue,
    errorValue: snapshot?.errorValue,
  })

  if (options.draftInput != null) {
    const handle = resolveSheetHandle(nextCell.sheetId)
    handle?.sheetModel.setCellInput(nextCell, rawInput)
    syncEditorCellDisplay()
  }

  if (options.focus) {
    focusFormulaBar(selection)
  }
}

function resolveSelectedGridCell(): DataGridSpreadsheetCellAddress | null {
  const currentSheet = activeSheetHandle.value
  const activeCell = selectionSnapshot.value?.activeCell
  if (!currentSheet || !activeCell) {
    return null
  }
  const columnKey = visibleColumns.value[activeCell.colIndex]?.key
  const rowNode = runtimeBundle.api.rows.get(activeCell.rowIndex)
  if (!columnKey || !rowNode || rowNode.kind === "group") {
    return null
  }
  return {
    sheetId: currentSheet.id,
    rowId: rowNode.rowId,
    rowIndex: activeCell.rowIndex,
    columnKey,
  }
}

function focusGridCell(cell: DataGridSpreadsheetCellAddress): void {
  const columnIndex = visibleColumnIndexByKey.value.get(cell.columnKey)
  if (columnIndex == null) {
    return
  }
  void nextTick(() => {
    const selector = `.spreadsheet-grid-host .grid-cell[data-row-index="${cell.rowIndex}"][data-column-index="${columnIndex}"]`
    const element = cardRootRef.value?.querySelector<HTMLElement>(selector)
    element?.focus({ preventScroll: true })
  })
}

function restoreEditorCellSelection(options: { focusGrid?: boolean } = {}): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  suppressNextSelectionSync = true
  applySingleCellSelection(activeCell)
  if (options.focusGrid) {
    focusGridCell(activeCell)
  }
}

function insertReferenceFromCell(targetCell: DataGridSpreadsheetCellAddress): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  editorModel.insertReference({
    referenceName: targetCell.columnKey,
    rowIndex: targetCell.rowIndex,
  })
  const handle = resolveSheetHandle(activeCell.sheetId)
  handle?.sheetModel.setCellInput(activeCell, editorSnapshot.value.rawInput)
  syncEditorCellDisplay()
}

function openSheet(sheetId: string): void {
  if (!workbook.setActiveSheet(sheetId)) {
    return
  }
  const handle = workbook.getSheet(sheetId)
  if (!handle) {
    return
  }
  const firstColumnKey = handle.sheetModel.getColumns()[0]?.key
  const firstRow = handle.sheetModel.getRows()[0]
  if (!firstColumnKey || !firstRow) {
    return
  }
  const nextCell = {
    sheetId: handle.id,
    rowId: firstRow.id,
    rowIndex: firstRow.rowIndex,
    columnKey: firstColumnKey,
  }
  openEditorCell(nextCell)
  void nextTick(() => {
    restoreEditorCellSelection()
  })
}

function syncFormulaSelectionFromDom(): void {
  const input = formulaInputRef.value
  if (!input) {
    return
  }
  editorModel.setSelection({
    start: input.selectionStart ?? 0,
    end: input.selectionEnd ?? input.selectionStart ?? 0,
  })
}

function handleFormulaInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement | null
  const activeCell = editorSnapshot.value.activeCell
  if (!target || !activeCell) {
    return
  }
  editorModel.setInput(target.value)
  editorModel.setSelection({
    start: target.selectionStart ?? target.value.length,
    end: target.selectionEnd ?? target.selectionStart ?? target.value.length,
  })
  const handle = resolveSheetHandle(activeCell.sheetId)
  handle?.sheetModel.setCellInput(activeCell, target.value)
  syncEditorCellDisplay()
}

function handleFormulaFocus(): void {
  if (formulaBlurTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(formulaBlurTimer)
    formulaBlurTimer = null
  }
  allowFormulaBlur = false
  isFormulaBarFocused.value = true
  syncFormulaSelectionFromDom()
}

function shouldPreserveFormulaFocusForGridInteraction(): boolean {
  return isFormulaBarFocused.value
    && editorSnapshot.value.analysis.kind === "formula"
    && editorSnapshot.value.activeCell != null
}

function handleGridPointerDownCapture(): void {
  preserveFormulaFocusFromGridPointer = shouldPreserveFormulaFocusForGridInteraction()
}

function handleFormulaBlur(): void {
  if (typeof window === "undefined") {
    if (allowFormulaBlur) {
      allowFormulaBlur = false
    }
    isFormulaBarFocused.value = false
    return
  }
  formulaBlurTimer = window.setTimeout(() => {
    if (preserveFormulaFocusFromGridPointer && !allowFormulaBlur) {
      preserveFormulaFocusFromGridPointer = false
      formulaBlurTimer = null
      focusFormulaBar(editorSnapshot.value.selection)
      return
    }
    preserveFormulaFocusFromGridPointer = false
    allowFormulaBlur = false
    isFormulaBarFocused.value = false
    formulaBlurTimer = null
  }, 0)
}

function handleFormulaKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault()
    allowFormulaBlur = true
    restoreEditorCellSelection({ focusGrid: true })
    formulaInputRef.value?.blur()
    return
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    allowFormulaBlur = true
    restoreEditorCellSelection({ focusGrid: true })
    formulaInputRef.value?.blur()
  }
}

function isPrintableEditingKey(event: KeyboardEvent): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1
}

function beginGridEdit(cell: DataGridSpreadsheetCellAddress, draftInput?: string): void {
  openEditorCell(cell, {
    focus: true,
    draftInput: draftInput ?? null,
    selectAll: draftInput == null,
  })
}

function resolveCellAddressFromOffsets(
  rowOffset: number,
  columnIndex: number,
): DataGridSpreadsheetCellAddress | null {
  const currentSheet = activeSheetHandle.value
  const rowIndex = tableStageProps.value.viewportRowStart + rowOffset
  const rowNode = runtimeBundle.api.rows.get(rowIndex)
  const columnKey = visibleColumns.value[columnIndex]?.key
  if (!currentSheet || !rowNode || rowNode.kind === "group" || !columnKey) {
    return null
  }
  return {
    sheetId: currentSheet.id,
    rowId: rowNode.rowId,
    rowIndex,
    columnKey,
  }
}

function handleGridCellKeydown(
  event: KeyboardEvent,
  row: { rowId: DataGridRowId },
  rowOffset: number,
  columnIndex: number,
): void {
  const targetCell = resolveCellAddressFromOffsets(rowOffset, columnIndex)
  if (targetCell && (event.key === "Enter" || event.key === "F2")) {
    event.preventDefault()
    beginGridEdit(targetCell)
    return
  }
  if (targetCell && isPrintableEditingKey(event)) {
    event.preventDefault()
    beginGridEdit(targetCell, event.key)
    return
  }
  tableStageProps.value.handleCellKeydown(event, row as never, rowOffset, columnIndex)
}

function handleGridViewportKeydown(event: KeyboardEvent): void {
  const targetCell = resolveSelectedGridCell()
  if (targetCell && (event.key === "Enter" || event.key === "F2")) {
    event.preventDefault()
    beginGridEdit(targetCell)
    return
  }
  if (targetCell && isPrintableEditingKey(event)) {
    event.preventDefault()
    beginGridEdit(targetCell, event.key)
    return
  }
  tableStageProps.value.handleViewportKeydown(event)
}

function handleGridInlineEditRequest(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  columnKey: string,
): void {
  const currentSheet = activeSheetHandle.value
  const rowData = row.data as SpreadsheetGridRow | undefined
  if (!currentSheet || !rowData) {
    return
  }
  beginGridEdit({
    sheetId: currentSheet.id,
    rowId: row.rowId,
    rowIndex: rowData.__rowIndex,
    columnKey,
  })
}

function collectSelectedAddresses(): readonly DataGridSpreadsheetCellAddress[] {
  const currentSheet = activeSheetHandle.value
  const snapshot = selectionSnapshot.value
  if (!currentSheet || !snapshot || snapshot.ranges.length === 0) {
    return editorSnapshot.value.activeCell ? [editorSnapshot.value.activeCell] : []
  }
  const addresses: DataGridSpreadsheetCellAddress[] = []
  const seen = new Set<string>()

  for (const range of snapshot.ranges) {
    const startRow = Math.min(range.startRow, range.endRow)
    const endRow = Math.max(range.startRow, range.endRow)
    const startColumn = Math.min(range.startCol, range.endCol)
    const endColumn = Math.max(range.startCol, range.endCol)
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      const rowNode = runtimeBundle.api.rows.get(rowIndex)
      if (!rowNode || rowNode.kind === "group") {
        continue
      }
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        const columnKey = visibleColumns.value[columnIndex]?.key
        if (!columnKey) {
          continue
        }
        const address = {
          sheetId: currentSheet.id,
          rowId: rowNode.rowId,
          rowIndex,
          columnKey,
        }
        const scopedKey = makeScopedCellKey(address)
        if (seen.has(scopedKey)) {
          continue
        }
        seen.add(scopedKey)
        addresses.push(address)
      }
    }
  }

  return addresses
}

function applyStylePreset(presetId: SpreadsheetStylePresetId): void {
  const currentSheet = activeSheetHandle.value
  if (!currentSheet) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: STYLE_PRESETS[presetId],
  })))
}

function clearSelectedStyles(): void {
  const currentSheet = activeSheetHandle.value
  if (!currentSheet) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: null,
  })))
}

function copyStyleFromActiveCell(): void {
  const cell = resolveCellSnapshot(editorSnapshot.value.activeCell)
  copiedStyle.value = cell?.style ?? null
}

function pasteStyleToSelection(): void {
  const currentSheet = activeSheetHandle.value
  if (!currentSheet || copiedStyle.value == null) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: copiedStyle.value,
  })))
}

const referenceHighlightByCellKey = computed(() => {
  const currentSheetId = activeSheetHandle.value?.id ?? null
  const activeReferenceKey = editorSnapshot.value.activeReferenceKey
  const highlightByKey = new Map<string, { active: boolean; palette: ReturnType<typeof resolvePalette> }>()

  if (!currentSheetId || editorSnapshot.value.analysis.kind !== "formula") {
    return highlightByKey
  }

  for (const reference of editorSnapshot.value.analysis.references) {
    const palette = resolvePalette(reference.colorIndex)
    for (const rowIndex of reference.targetRowIndexes) {
      const localKey = makeLocalCellKey(rowIndex, reference.referenceName)
      const current = highlightByKey.get(localKey)
      if (!current) {
        highlightByKey.set(localKey, {
          active: reference.key === activeReferenceKey,
          palette,
        })
        continue
      }
      if (reference.key === activeReferenceKey) {
        highlightByKey.set(localKey, {
          active: true,
          palette: current.palette,
        })
      }
    }
  }

  return highlightByKey
})

function resolveSpreadsheetCellClass(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  _rowOffset: number,
  column: DataGridColumnSnapshot,
): Record<string, boolean> {
  const rowData = row.data as SpreadsheetGridRow | undefined
  const rowIndex = rowData?.__rowIndex
  const cell = typeof rowIndex === "number"
    ? activeSheetView.value.cellsByKey.get(makeLocalCellKey(rowIndex, column.key)) ?? null
    : null
  const isActiveCell = areCellsEqual(editorSnapshot.value.activeCell, {
    sheetId: activeSheetHandle.value?.id ?? null,
    rowId: row.rowId,
    rowIndex: rowIndex ?? -1,
    columnKey: column.key,
  })
  const referenceHighlight = typeof rowIndex === "number"
    ? referenceHighlightByCellKey.value.get(makeLocalCellKey(rowIndex, column.key))
    : null

  return {
    "spreadsheet-cell--formula": cell?.inputKind === "formula",
    "spreadsheet-cell--error": cell?.errorValue != null,
    "spreadsheet-cell--active": isActiveCell,
    "spreadsheet-cell--reference": referenceHighlight != null,
    "spreadsheet-cell--reference-active": referenceHighlight?.active === true,
  }
}

function resolveSpreadsheetCellStyle(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  _rowOffset: number,
  column: DataGridColumnSnapshot,
): Readonly<Record<string, string | number>> {
  const rowData = row.data as SpreadsheetGridRow | undefined
  const rowIndex = rowData?.__rowIndex
  const cell = typeof rowIndex === "number"
    ? activeSheetView.value.cellsByKey.get(makeLocalCellKey(rowIndex, column.key)) ?? null
    : null
  const baseStyle = resolveCellVisualStyle(cell?.style)
  const referenceHighlight = typeof rowIndex === "number"
    ? referenceHighlightByCellKey.value.get(makeLocalCellKey(rowIndex, column.key))
    : null
  const isActiveCell = areCellsEqual(editorSnapshot.value.activeCell, {
    sheetId: activeSheetHandle.value?.id ?? null,
    rowId: row.rowId,
    rowIndex: rowIndex ?? -1,
    columnKey: column.key,
  })

  const referenceStyle = referenceHighlight
    ? {
        backgroundColor: referenceHighlight.active ? referenceHighlight.palette.solid : referenceHighlight.palette.soft,
        boxShadow: `inset 0 0 0 2px ${referenceHighlight.palette.border}`,
      }
    : {}

  const activeStyle = isActiveCell
    ? {
        boxShadow: mergeBoxShadow(
          referenceStyle.boxShadow,
          "inset 0 0 0 1px rgba(15, 23, 42, 0.75)",
          "0 0 0 1px rgba(255, 255, 255, 0.95)",
        ),
      }
    : {}

  const errorStyle = cell?.errorValue
    ? {
        color: "#b91c1c",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        boxShadow: mergeBoxShadow(referenceStyle.boxShadow, "inset 0 0 0 1px rgba(220, 38, 38, 0.72)"),
      }
    : {}

  return {
    ...(baseStyle.backgroundColor ? { backgroundColor: String(baseStyle.backgroundColor) } : {}),
    ...(baseStyle.color ? { color: String(baseStyle.color) } : {}),
    ...(baseStyle.fontWeight ? { fontWeight: baseStyle.fontWeight as string | number } : {}),
    ...(baseStyle.fontStyle ? { fontStyle: String(baseStyle.fontStyle) } : {}),
    ...(baseStyle.textAlign ? { textAlign: String(baseStyle.textAlign) } : {}),
    ...(baseStyle.boxShadow ? { boxShadow: String(baseStyle.boxShadow) } : {}),
    ...(referenceStyle.backgroundColor ? { backgroundColor: referenceStyle.backgroundColor } : {}),
    ...(referenceStyle.boxShadow ? { boxShadow: referenceStyle.boxShadow } : {}),
    ...(activeStyle.boxShadow ? { boxShadow: activeStyle.boxShadow } : {}),
    ...(errorStyle.backgroundColor ? { backgroundColor: errorStyle.backgroundColor } : {}),
    ...(errorStyle.color ? { color: errorStyle.color } : {}),
    ...(errorStyle.boxShadow ? { boxShadow: errorStyle.boxShadow } : {}),
  }
}

const tableStagePropsForView = computed<Record<string, unknown>>(() => ({
  ...(tableStageProps.value as unknown as Record<string, unknown>),
  sourceRows: gridRows.value,
  columnMenuEnabled: false,
  isEditingCell: () => false,
  startInlineEdit: handleGridInlineEditRequest,
  handleCellKeydown: handleGridCellKeydown,
  handleViewportKeydown: handleGridViewportKeydown,
  handleEditorKeydown: () => {},
  commitInlineEdit: () => {},
  editingCellValue: "",
  cellClass: resolveSpreadsheetCellClass,
  cellStyle: resolveSpreadsheetCellStyle,
}))

const formulaPreviewSegments = computed<readonly FormulaPreviewSegment[]>(() => {
  const rawInput = editorSnapshot.value.rawInput
  const references = editorSnapshot.value.analysis.references
  if (rawInput.length === 0) {
    return Object.freeze([
      {
        key: "empty",
        kind: "plain",
        text: "Formula preview",
      },
    ])
  }

  const segments: FormulaPreviewSegment[] = []
  let cursor = 0
  for (const reference of references) {
    if (reference.span.start > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        kind: "plain",
        text: rawInput.slice(cursor, reference.span.start),
      })
    }
    const palette = resolvePalette(reference.colorIndex)
    segments.push({
      key: reference.key,
      kind: "reference",
      text: rawInput.slice(reference.span.start, reference.span.end),
      active: reference.key === editorSnapshot.value.activeReferenceKey,
      style: Object.freeze({
        color: palette.text,
        backgroundColor: reference.key === editorSnapshot.value.activeReferenceKey ? palette.solid : palette.soft,
        boxShadow: `inset 0 -1px 0 ${palette.border}`,
      }),
    })
    cursor = reference.span.end
  }
  if (cursor < rawInput.length) {
    segments.push({
      key: `plain-${cursor}`,
      kind: "plain",
      text: rawInput.slice(cursor),
    })
  }
  return Object.freeze(segments)
})

const referenceLegend = computed<readonly ReferenceLegendEntry[]>(() => {
  return Object.freeze(editorSnapshot.value.analysis.references.map(reference => {
    const palette = resolvePalette(reference.colorIndex)
    return {
      key: reference.key,
      text: reference.text,
      active: reference.key === editorSnapshot.value.activeReferenceKey,
      targetsLabel: reference.targetRowIndexes.length === 0
        ? "out of range"
        : reference.targetRowIndexes.map(rowIndex => `r${rowIndex + 1}`).join(", "),
      style: Object.freeze({
        color: palette.text,
        borderColor: palette.border,
        backgroundColor: reference.key === editorSnapshot.value.activeReferenceKey ? palette.solid : palette.soft,
      }),
    }
  }))
})

const activeCellSnapshot = computed(() => {
  void workbookRevision.value
  return resolveCellSnapshot(editorSnapshot.value.activeCell)
})

const activeCellBadge = computed(() => {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return "No active cell"
  }
  return formatCellReferenceLabel(activeSheetHandle.value?.name, activeCell.columnKey, activeCell.rowIndex)
})

const activeCellDisplayLabel = computed(() => {
  const activeCell = activeCellSnapshot.value
  if (!activeCell) {
    return "—"
  }
  if (activeCell.errorValue) {
    return "#ERROR"
  }
  return formatPreviewValue(activeCell.displayValue)
})

const activeDiagnosticMessage = computed(() => {
  const firstDiagnostic = editorSnapshot.value.analysis.diagnostics[0]
  if (firstDiagnostic?.message) {
    return firstDiagnostic.message
  }
  const errorValue = activeCellSnapshot.value?.errorValue as { message?: unknown } | null | undefined
  return typeof errorValue?.message === "string" ? errorValue.message : ""
})

const selectedRangeLabel = computed(() => {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return "No selection"
  }
  const range = snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0]
  if (!range) {
    return "No selection"
  }
  const rowSpan = Math.abs(range.endRow - range.startRow) + 1
  const columnSpan = Math.abs(range.endCol - range.startCol) + 1
  return `${rowSpan} row${rowSpan === 1 ? "" : "s"} × ${columnSpan} column${columnSpan === 1 ? "" : "s"}`
})

watch(
  () => [
    workbookSnapshot.value.activeSheetId,
    totalRows.value,
    visibleColumns.value.map(column => column.key).join("|"),
  ].join("::"),
  () => {
    const currentSheet = activeSheetHandle.value
    if (!currentSheet || totalRows.value <= 0 || visibleColumns.value.length === 0) {
      return
    }
    const currentEditorCell = editorSnapshot.value.activeCell
    const nextCell = currentEditorCell
      && currentEditorCell.sheetId === currentSheet.id
      && currentEditorCell.rowIndex < totalRows.value
      && visibleColumnIndexByKey.value.has(currentEditorCell.columnKey)
      ? currentEditorCell
      : {
          sheetId: currentSheet.id,
          rowId: activeSheetView.value.rowSnapshots[0]?.id ?? null,
          rowIndex: 0,
          columnKey: visibleColumns.value[0]?.key ?? activeSheetView.value.columns[0]?.key ?? "",
        }
    if (!nextCell.columnKey) {
      return
    }
    openEditorCell(nextCell)
    void nextTick(() => {
      restoreEditorCellSelection()
    })
  },
  { immediate: true },
)

watch(
  () => makeScopedCellKey(resolveSelectedGridCell()),
  () => {
    const nextCell = resolveSelectedGridCell()
    if (!nextCell) {
      return
    }
    if (suppressNextSelectionSync) {
      suppressNextSelectionSync = false
      return
    }
    if (
      isFormulaBarFocused.value
      && editorSnapshot.value.analysis.kind === "formula"
      && editorSnapshot.value.activeCell
      && !areCellsEqual(nextCell, editorSnapshot.value.activeCell)
    ) {
      insertReferenceFromCell(nextCell)
      void nextTick(() => {
        restoreEditorCellSelection()
        focusFormulaBar(editorSnapshot.value.selection)
      })
      return
    }
    if (!areCellsEqual(nextCell, editorSnapshot.value.activeCell)) {
      openEditorCell(nextCell)
    }
  },
)

watch(workbookRevision, () => {
  syncEditorCellDisplay()
})

function moveCaretToReference(referenceKey: string): void {
  const reference = editorSnapshot.value.analysis.references.find(entry => entry.key === referenceKey)
  if (!reference) {
    return
  }
  editorModel.setSelection({
    start: reference.span.start,
    end: reference.span.end,
  })
  focusFormulaBar({
    start: reference.span.start,
    end: reference.span.end,
  })
}
</script>

<style scoped>
.spreadsheet-card {
  --spreadsheet-panel-bg: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.88));
  --spreadsheet-border: rgba(148, 163, 184, 0.25);
  --spreadsheet-ink-soft: rgba(71, 85, 105, 0.92);
  --spreadsheet-accent: #0f172a;
}

.spreadsheet-card__header {
  gap: 10px;
}

.spreadsheet-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.spreadsheet-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--datagrid-text-color);
  cursor: pointer;
}

.spreadsheet-tab--active {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(37, 99, 235, 0.9));
  border-color: rgba(37, 99, 235, 0.55);
  color: #f8fafc;
}

.spreadsheet-tab__name {
  font-weight: 600;
}

.spreadsheet-tab__meta {
  font-size: 11px;
  opacity: 0.72;
}

.spreadsheet-style-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-action {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--datagrid-text-color);
  cursor: pointer;
}

.spreadsheet-action:disabled {
  opacity: 0.45;
  cursor: default;
}

.spreadsheet-formula-shell {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 220px;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
}

.spreadsheet-formula-shell--focused {
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.28);
}

.spreadsheet-formula-address {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--spreadsheet-accent);
  font-weight: 600;
}

.spreadsheet-formula-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.spreadsheet-formula-input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--datagrid-text-color);
  font: 500 13px/1.5 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.spreadsheet-formula-preview {
  min-height: 24px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--spreadsheet-ink-soft);
  font: 500 12px/1.5 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.spreadsheet-formula-token--reference {
  border-radius: 6px;
  padding: 0 2px;
}

.spreadsheet-formula-token--active {
  font-weight: 700;
}

.spreadsheet-formula-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.spreadsheet-formula-value {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spreadsheet-formula-state__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-error {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.4;
}

.spreadsheet-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

.spreadsheet-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.spreadsheet-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 16px;
  background: var(--spreadsheet-panel-bg);
}

.spreadsheet-panel h3 {
  margin: 0;
  font-size: 13px;
}

.spreadsheet-panel p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.spreadsheet-reference-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font: 500 12px/1 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.spreadsheet-reference-chip--active {
  box-shadow: 0 0 0 1px currentColor;
}

.spreadsheet-empty-state,
.spreadsheet-selection-summary,
.spreadsheet-selection-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-grid-host {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
}

.spreadsheet-cell--formula {
  font-weight: 600;
}

.spreadsheet-cell--error {
  text-decoration: underline wavy rgba(220, 38, 38, 0.72);
  text-underline-offset: 3px;
}

.spreadsheet-cell--reference {
  transition: box-shadow 120ms ease, background-color 120ms ease;
}

.spreadsheet-cell--reference-active {
  font-weight: 700;
}

:deep(.spreadsheet-grid-host .col-filter) {
  display: none;
}

:deep(.spreadsheet-grid-host .sort-indicator) {
  opacity: 0.24;
}

:deep(.spreadsheet-grid-host .grid-cell--header) {
  min-height: 40px;
  background: rgba(248, 250, 252, 0.95);
}

:deep(.spreadsheet-grid-host .grid-cell) {
  font-size: 12px;
}

@media (max-width: 1200px) {
  .spreadsheet-formula-shell {
    grid-template-columns: 1fr;
  }

  .spreadsheet-layout {
    grid-template-columns: 1fr;
  }

  .spreadsheet-sidebar {
    order: 2;
  }
}
</style>
