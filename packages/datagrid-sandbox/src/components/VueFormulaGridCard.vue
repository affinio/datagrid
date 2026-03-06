<template>
  <article class="card">
    <header class="card__header">
      <div class="card__title-row">
        <h2>Vue: Formula Grid</h2>
        <div class="mode-badge">Formula</div>
      </div>

      <div class="controls">
        <label>
          Rows
          <select v-model.number="rowCount">
            <option v-for="option in ROW_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>

        <label>
          Patch size
          <select v-model.number="patchSize">
            <option v-for="option in PATCH_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>

        <button type="button" @click="applyRandomPatch">Patch random rows</button>
        <button type="button" @click="recomputeFormulas">Recompute formulas</button>
        <button type="button" @click="rebuildModel">Rebuild model</button>
      </div>

      <div class="meta">
        <span>Rows in model: {{ rows.length }}</span>
        <span>Formulas: {{ formulaPlan?.order.length ?? 0 }}</span>
        <span>Levels: {{ formulaPlan?.levels.length ?? 0 }}</span>
        <span>Last action: {{ lastAction }}</span>
      </div>

      <div class="meta">
        <span>Compute strategy: {{ computeStage?.strategy ?? "—" }}</span>
        <span>Rows touched: {{ computeStage?.rowsTouched ?? 0 }}</span>
        <span>Evaluations: {{ computeStage?.evaluations ?? 0 }}</span>
        <span>Dirty nodes: {{ dirtyNodesLabel }}</span>
      </div>
    </header>

    <section class="grid-stage">
      <DataGrid
        :rows="rows"
        :row-model="rowModelForGrid"
        :columns="columns"
        :features="features"
        theme="light"
        render-mode="virtualization"
        @cell-change="refreshDiagnostics"
      />
    </section>

    <section class="editor-stage">
      <h3>Inline formula sandbox</h3>
      <p class="editor-hint">
        Edit source values below (first {{ editorRows.length }} rows) and see computed columns update immediately.
      </p>
      <div class="editor-table-wrap">
        <table class="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Tax rate</th>
              <th>Shipping</th>
              <th>Discount</th>
              <th>Cost</th>
              <th>Subtotal</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in editorRows" :key="`editor-${String(row.rowId)}`">
              <td>{{ row.id }}</td>
              <td>
                <input
                  :value="row.product"
                  @change="patchInlineCell(row.rowId, 'product', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  :value="row.price"
                  @change="patchInlineCell(row.rowId, 'price', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  min="1"
                  :value="row.qty"
                  @change="patchInlineCell(row.rowId, 'qty', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  :value="row.taxRate"
                  @change="patchInlineCell(row.rowId, 'taxRate', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  :value="row.shipping"
                  @change="patchInlineCell(row.rowId, 'shipping', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  :value="row.discount"
                  @change="patchInlineCell(row.rowId, 'discount', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  :value="row.cost"
                  @change="patchInlineCell(row.rowId, 'cost', ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>{{ formatMoney(row.subtotal) }}</td>
              <td>{{ formatMoney(row.tax) }}</td>
              <td>{{ formatMoney(row.total) }}</td>
              <td>{{ formatMoney(row.margin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <footer class="card__footer">
      Formula chain:
      <span>{{ formulaPlan?.order.join(" -> ") || "—" }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import DataGrid from "@affino/datagrid-vue/components/DataGrid.vue"
import {
  createClientRowModel,
  type ClientRowModel,
  type DataGridColumnDef,
  type DataGridFormulaComputeStageDiagnostics,
  type DataGridFormulaExecutionPlanSnapshot,
  type DataGridRowId,
  type DataGridRowModel,
} from "@affino/datagrid-core"

interface FormulaSandboxRow {
  id: number
  product: string
  price: number
  qty: number
  taxRate: number
  shipping: number
  discount: number
  cost: number
  subtotal?: number
  tax?: number
  total?: number
  margin?: number
}

interface FormulaEditorRow extends FormulaSandboxRow {
  rowId: DataGridRowId
}

type DataGridFeatureName =
  | "selection"
  | "navigation"
  | "clipboard"
  | "history"
  | "fill"

const ROW_OPTIONS = [100, 1_000, 5_000] as const
const PATCH_OPTIONS = [1, 10, 100] as const

const columns: readonly DataGridColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "product", label: "Product" },
  { key: "price", label: "Price" },
  { key: "qty", label: "Qty" },
  { key: "taxRate", label: "Tax rate" },
  { key: "shipping", label: "Shipping" },
  { key: "discount", label: "Discount" },
  { key: "cost", label: "Cost" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "margin", label: "Margin" },
]

const features: readonly DataGridFeatureName[] = [
  "selection",
  "navigation",
  "clipboard",
  "history",
  "fill",
]

const rowCount = ref<number>(1_000)
const patchSize = ref<number>(10)
const lastAction = ref<string>("init")
const rows = ref<readonly FormulaSandboxRow[]>([])
const rowModel = ref<ClientRowModel<FormulaSandboxRow> | null>(null)
const formulaPlan = ref<DataGridFormulaExecutionPlanSnapshot | null>(null)
const computeStage = ref<DataGridFormulaComputeStageDiagnostics | null>(null)
const editorRevision = ref(0)

const rowModelForGrid = computed<DataGridRowModel<unknown> | undefined>(() => {
  return rowModel.value as unknown as DataGridRowModel<unknown> | null ?? undefined
})

const dirtyNodesLabel = computed(() => {
  if (!computeStage.value || computeStage.value.dirtyNodes.length === 0) {
    return "—"
  }
  return computeStage.value.dirtyNodes.join(", ")
})

const randomNumber = (min: number, max: number): number => {
  return min + Math.random() * (max - min)
}

const buildRows = (count: number): readonly FormulaSandboxRow[] => {
  const nextRows = new Array<FormulaSandboxRow>(count)
  for (let index = 0; index < count; index += 1) {
    nextRows[index] = {
      id: index + 1,
      product: `SKU-${index + 1}`,
      price: Math.round(randomNumber(20, 400) * 100) / 100,
      qty: Math.max(1, Math.trunc(randomNumber(1, 12))),
      taxRate: Math.round(randomNumber(0.02, 0.2) * 1000) / 1000,
      shipping: Math.round(randomNumber(0, 25) * 100) / 100,
      discount: Math.round(randomNumber(0, 20) * 100) / 100,
      cost: Math.round(randomNumber(10, 250) * 100) / 100,
    }
  }
  return nextRows
}

const refreshDiagnostics = (): void => {
  editorRevision.value += 1
  if (!rowModel.value) {
    formulaPlan.value = null
    computeStage.value = null
    return
  }
  formulaPlan.value = rowModel.value.getFormulaExecutionPlan()
  computeStage.value = rowModel.value.getFormulaComputeStageDiagnostics()
}

const editorRows = computed<readonly FormulaEditorRow[]>(() => {
  void editorRevision.value
  if (!rowModel.value) {
    return []
  }
  const limit = Math.min(12, rowModel.value.getRowCount())
  const nextRows: FormulaEditorRow[] = []
  for (let index = 0; index < limit; index += 1) {
    const rowNode = rowModel.value.getRow(index)
    const row = rowNode?.row as FormulaSandboxRow | undefined
    if (!rowNode || !row) {
      continue
    }
    nextRows.push({
      rowId: rowNode.rowId,
      id: row.id,
      product: row.product,
      price: row.price,
      qty: row.qty,
      taxRate: row.taxRate,
      shipping: row.shipping,
      discount: row.discount,
      cost: row.cost,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      margin: row.margin,
    })
  }
  return nextRows
})

const formatMoney = (value: number | undefined): string => {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—"
}

type InlineEditableField = "product" | "price" | "qty" | "taxRate" | "shipping" | "discount" | "cost"

const patchInlineCell = (rowId: DataGridRowId, field: InlineEditableField, raw: string): void => {
  if (!rowModel.value) {
    return
  }
  if (field === "product") {
    rowModel.value.patchRows([
      {
        rowId,
        data: { product: raw },
      },
    ], { recomputeFilter: false, recomputeSort: false, recomputeGroup: false })
    lastAction.value = `edit:${String(rowId)}:${field}`
    refreshDiagnostics()
    return
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return
  }
  const normalized = field === "qty"
    ? Math.max(1, Math.trunc(parsed))
    : field === "taxRate"
      ? Math.max(0, Math.round(parsed * 1000) / 1000)
      : Math.max(0, Math.round(parsed * 100) / 100)

  rowModel.value.patchRows([
    {
      rowId,
      data: { [field]: normalized } as Partial<FormulaSandboxRow>,
    },
  ], { recomputeFilter: false, recomputeSort: false, recomputeGroup: false })
  lastAction.value = `edit:${String(rowId)}:${field}`
  refreshDiagnostics()
}

const recreateRowModel = (nextRows: readonly FormulaSandboxRow[]): void => {
  rowModel.value?.dispose()
  rowModel.value = createClientRowModel<FormulaSandboxRow>({
    rows: nextRows,
    resolveRowId: (row) => row.id,
    formulaColumnCacheMaxColumns: 32,
    initialFormulaFields: [
      { name: "subtotal", formula: "price * qty" },
      { name: "tax", formula: "subtotal * taxRate" },
      { name: "total", formula: "subtotal + tax + shipping - discount" },
      { name: "margin", formula: "total - cost" },
    ],
  })
  refreshDiagnostics()
}

const rebuildModel = (): void => {
  rows.value = buildRows(rowCount.value)
  recreateRowModel(rows.value)
  lastAction.value = `rebuild:${rowCount.value}`
}

const applyRandomPatch = (): void => {
  if (!rowModel.value || rows.value.length === 0) {
    return
  }
  const updatesById = new Map<DataGridRowId, Partial<FormulaSandboxRow>>()
  const totalRows = rowModel.value.getRowCount()
  const patchCount = Math.min(patchSize.value, totalRows)
  for (let index = 0; index < patchCount; index += 1) {
    const rowIndex = Math.floor(Math.random() * totalRows)
    const rowNode = rowModel.value.getRow(rowIndex)
    const current = rowNode?.row as FormulaSandboxRow | undefined
    if (!rowNode || !current) {
      continue
    }
    updatesById.set(rowNode.rowId, {
      price: Math.round((current.price + randomNumber(-5, 5)) * 100) / 100,
      qty: Math.max(1, current.qty + Math.trunc(randomNumber(-1, 2))),
      shipping: Math.max(0, Math.round((current.shipping + randomNumber(-2, 2)) * 100) / 100),
    })
  }
  rowModel.value.patchRows(
    Array.from(updatesById.entries()).map(([rowId, data]) => ({ rowId, data })),
    { recomputeFilter: false, recomputeSort: false, recomputeGroup: false },
  )
  lastAction.value = `patch:${updatesById.size}`
  refreshDiagnostics()
}

const recomputeFormulas = (): void => {
  if (!rowModel.value) {
    return
  }
  const recomputedRows = rowModel.value.recomputeComputedFields()
  lastAction.value = `recompute:${recomputedRows}`
  refreshDiagnostics()
}

watch(rowCount, () => {
  rebuildModel()
})

rebuildModel()

onBeforeUnmount(() => {
  rowModel.value?.dispose()
})
</script>

<style scoped>
.editor-stage {
  margin-top: 12px;
  border: 1px solid #d7d7d7;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.editor-stage h3 {
  margin: 0 0 6px;
  font-size: 14px;
}

.editor-hint {
  margin: 0 0 10px;
  font-size: 12px;
  opacity: 0.75;
}

.editor-table-wrap {
  max-height: 280px;
  overflow: auto;
}

.editor-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.editor-table th,
.editor-table td {
  border: 1px solid #e5e5e5;
  padding: 4px 6px;
  white-space: nowrap;
}

.editor-table thead th {
  position: sticky;
  top: 0;
  background: #fafafa;
  z-index: 1;
}

.editor-table input {
  width: 100%;
  min-width: 72px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 12px;
}
</style>
