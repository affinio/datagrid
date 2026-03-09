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

    <section class="grid-host">
      <DataGrid
        ref="gridRef"
        :rows="rows"
        :columns="columns"
        :client-row-model-options="clientRowModelOptions"
        :formula-column-cache-max-columns="32"
        compute-mode="sync"
        virtualization
        @cell-change="refreshDiagnostics"
      />
    </section>

    <footer class="card__footer">
      Formula chain:
      <span>{{ formulaPlan?.order.join(" -> ") || "—" }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { DataGrid, type DataGridAppColumnDef } from "@affino/datagrid-vue-app"
import type { DataGridFormulaComputeStageDiagnostics, DataGridRowId } from "@affino/datagrid-vue"

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

interface FormulaExplainSnapshot {
  executionPlan: {
    order: readonly string[]
    levels: readonly unknown[]
  } | null
  computeStage: DataGridFormulaComputeStageDiagnostics | null
}

interface PublicFormulaGridApi {
  rows: {
    getCount: () => number
    get: (index: number) => { rowId: DataGridRowId; kind?: string; data?: FormulaSandboxRow } | undefined
    patch: (
      updates: readonly { rowId: DataGridRowId; data: Partial<FormulaSandboxRow> }[],
      options?: {
        recomputeFilter?: boolean
        recomputeSort?: boolean
        recomputeGroup?: boolean
      },
    ) => void
    recomputeComputedFields: (rowIds?: readonly DataGridRowId[]) => number
  }
  diagnostics: {
    getFormulaExplain: () => FormulaExplainSnapshot
  }
}

interface PublicFormulaGridExpose {
  getApi: () => PublicFormulaGridApi | null
}

const ROW_OPTIONS = [100, 1_000, 5_000] as const
const PATCH_OPTIONS = [1, 10, 100] as const
const columns: readonly DataGridAppColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "product", label: "Product" },
  { key: "price", label: "Price" },
  { key: "qty", label: "Qty" },
  { key: "taxRate", label: "Tax rate" },
  { key: "shipping", label: "Shipping" },
  { key: "discount", label: "Discount" },
  { key: "cost", label: "Cost" },
  { key: "subtotal", label: "Subtotal", formula: "price * qty" },
  { key: "tax", label: "Tax", formula: "subtotal * taxRate" },
  { key: "total", label: "Total", formula: "subtotal + tax + shipping - discount" },
  { key: "margin", label: "Margin", formula: "total - cost" },
]

const rowCount = ref<number>(1_000)
const patchSize = ref<number>(10)
const lastAction = ref<string>("init")
const rows = ref<readonly FormulaSandboxRow[]>([])
const gridRef = ref<PublicFormulaGridExpose | null>(null)
const formulaPlan = ref<FormulaExplainSnapshot["executionPlan"]>(null)
const computeStage = ref<DataGridFormulaComputeStageDiagnostics | null>(null)
const clientRowModelOptions = {
  resolveRowId: (row: unknown) => (row as FormulaSandboxRow).id,
}

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
  const api = gridRef.value?.getApi()
  if (!api) {
    formulaPlan.value = null
    computeStage.value = null
    return
  }
  const explain = api.diagnostics.getFormulaExplain()
  formulaPlan.value = explain.executionPlan
  computeStage.value = explain.computeStage
}

const rebuildModel = (): void => {
  rows.value = buildRows(rowCount.value)
  lastAction.value = `rebuild:${rowCount.value}`
  void nextTick(() => {
    refreshDiagnostics()
  })
}

const applyRandomPatch = (): void => {
  const api = gridRef.value?.getApi()
  if (!api || rows.value.length === 0) {
    return
  }
  const updatesById = new Map<DataGridRowId, Partial<FormulaSandboxRow>>()
  const totalRows = api.rows.getCount()
  const patchCount = Math.min(patchSize.value, totalRows)
  for (let index = 0; index < patchCount; index += 1) {
    const rowIndex = Math.floor(Math.random() * totalRows)
    const rowNode = api.rows.get(rowIndex)
    const current = rowNode?.data
    if (!rowNode || !current || rowNode.kind === "group") {
      continue
    }
    updatesById.set(rowNode.rowId, {
      price: Math.round((current.price + randomNumber(-5, 5)) * 100) / 100,
      qty: Math.max(1, current.qty + Math.trunc(randomNumber(-1, 2))),
      shipping: Math.max(0, Math.round((current.shipping + randomNumber(-2, 2)) * 100) / 100),
    })
  }
  api.rows.patch(
    Array.from(updatesById.entries()).map(([rowId, data]) => ({ rowId, data })),
    { recomputeFilter: false, recomputeSort: false, recomputeGroup: false },
  )
  lastAction.value = `patch:${updatesById.size}`
  refreshDiagnostics()
}

const recomputeFormulas = (): void => {
  const api = gridRef.value?.getApi()
  if (!api) {
    return
  }
  const recomputedRows = api.rows.recomputeComputedFields()
  lastAction.value = `recompute:${recomputedRows}`
  refreshDiagnostics()
}

watch(rowCount, () => {
  rebuildModel()
})

watch(
  () => gridRef.value,
  () => {
    void nextTick(() => {
      refreshDiagnostics()
    })
  },
)

rebuildModel()
</script>

<style scoped>
.grid-host {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
</style>
