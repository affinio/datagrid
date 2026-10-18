<template>
  <article class="flex-demo">
    <header class="flex-demo__intro">
      <p class="flex-demo__eyebrow">Column sizing stress case</p>
      <h2>Do flexible columns keep the table filled?</h2>
      <p>
        Two columns use <code>flex</code>; the rest have fixed widths. Hide, pin,
        and reorder them to see whether the center viewport keeps using its space.
      </p>
    </header>

    <section class="flex-demo__controls" aria-label="Column layout stress controls">
      <div class="flex-demo__presets">
        <button type="button" @click="hideFlexibleColumns">Hide both flex columns</button>
        <button type="button" @click="hideFixedColumns">Keep only flex columns</button>
        <button type="button" @click="pinWorkstream">Pin flex column left</button>
        <button type="button" @click="moveWorkstreamToEnd">Move flex column to end</button>
        <button type="button" @click="resetState">Reset</button>
      </div>
      <div class="flex-demo__column-controls">
        <label v-for="column in columns" :key="column.key" class="flex-demo__column-control">
          <input
            type="checkbox"
            :checked="columnState.visibility[column.key] !== false"
            @change="setVisible(column.key, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ column.label }}</span>
          <small>{{ column.flex ? `flex ${column.flex}` : `${column.initialState?.width}px` }}</small>
          <select
            :aria-label="`${column.label} pin`"
            :value="columnState.pins[column.key] ?? 'none'"
            @change="setPin(column.key, ($event.target as HTMLSelectElement).value as Pin)"
          >
            <option value="none">Center</option>
            <option value="left">Pin left</option>
            <option value="right">Pin right</option>
          </select>
        </label>
      </div>
    </section>

    <dl class="flex-demo__metrics" data-testid="flex-sizing-metrics">
      <div><dt>Center viewport</dt><dd>{{ metrics.viewport }} px</dd></div>
      <div><dt>Center content</dt><dd>{{ metrics.content }} px</dd></div>
      <div :class="{ 'flex-demo__metric--gap': metrics.gap > 24 }"><dt>Unused space</dt><dd>{{ metrics.gap }} px</dd></div>
      <div><dt>Visible flex columns</dt><dd>{{ visibleFlexCount }}</dd></div>
    </dl>

    <section class="flex-demo__host" data-testid="column-flex-host">
      <DataGrid
        :rows="rows"
        :columns="columns"
        :column-state="columnState"
        :row-selection="false"
        :show-row-index="false"
        layout-mode="fill"
        virtualization
        @update:column-state="handleColumnStateUpdate"
      />
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import type { DataGridUnifiedColumnState } from "@affino/datagrid-vue"
import type { DataGridAppColumnInput } from "@affino/datagrid-vue-app"

type Pin = "none" | "left" | "right"

const columns: readonly DataGridAppColumnInput[] = [
  { key: "workstream", label: "Workstream", flex: 1, minWidth: 160, initialState: { width: 160 } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "status", label: "Status", initialState: { width: 110 } },
  { key: "region", label: "Region", initialState: { width: 110 } },
  { key: "priority", label: "Priority", initialState: { width: 110 } },
  { key: "updated", label: "Updated", initialState: { width: 110 } },
  { key: "notes", label: "Notes", flex: 2, minWidth: 150, initialState: { width: 150 } },
]
const keys = columns.map(column => column.key)
const initialState: DataGridUnifiedColumnState = {
  order: keys,
  visibility: Object.fromEntries(keys.map(key => [key, true])),
  widths: Object.fromEntries(columns.map(column => [column.key, column.initialState?.width ?? null])),
  pins: Object.fromEntries(keys.map(key => [key, "none"])),
}
const columnState = ref<DataGridUnifiedColumnState>(initialState)
const rows = Array.from({ length: 180 }, (_, index) => ({
  id: `flex-row-${index}`,
  workstream: ["Orion rollout", "Northstar migration", "Atlas reliability", "Mercury reporting"][index % 4],
  owner: ["A. Kim", "M. Chen", "R. Patel", "S. Ivanov"][index % 4],
  status: ["On track", "At risk", "Blocked", "Review"][index % 4],
  region: ["West", "Central", "East", "Global"][index % 4],
  priority: ["P0", "P1", "P2"][index % 3],
  updated: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
  notes: `Long operational note ${index + 1}: ownership and delivery details should stay readable when columns move or become pinned.`,
}))
const visibleFlexCount = computed(() => columns.filter(column => column.flex && columnState.value.visibility[column.key] !== false).length)
const metrics = ref({ viewport: 0, content: 0, gap: 0, overflow: 0 })
let resizeObserver: ResizeObserver | null = null
let metricsFrame = 0
const observedHeaderCells = new WeakSet<Element>()

function refreshMetrics(): void {
  cancelAnimationFrame(metricsFrame)
  metricsFrame = requestAnimationFrame(() => {
    metricsFrame = requestAnimationFrame(() => {
      const host = document.querySelector<HTMLElement>("[data-testid='column-flex-host']")
      const viewport = host?.querySelector<HTMLElement>(".grid-header-viewport")
      if (viewport && resizeObserver) {
        resizeObserver.observe(viewport)
      }
      const width = viewport?.clientWidth ?? 0
      const headers = viewport ? [...viewport.querySelectorAll<HTMLElement>(".grid-cell--header[data-column-key]")] : []
      if (resizeObserver) {
        for (const header of headers) {
          if (!observedHeaderCells.has(header)) {
            observedHeaderCells.add(header)
            resizeObserver.observe(header)
          }
        }
      }
      const content = viewport && viewport.scrollWidth > width
        ? viewport.scrollWidth
        : headers.reduce((sum, header) => sum + header.getBoundingClientRect().width, 0)
      metrics.value = { viewport: width, content, gap: Math.max(0, width - content), overflow: Math.max(0, content - width) }
    })
  })
}

function patchState(patch: Partial<DataGridUnifiedColumnState>): void {
  columnState.value = { ...columnState.value, ...patch }
}
function setVisible(key: string, visible: boolean): void {
  patchState({ visibility: { ...columnState.value.visibility, [key]: visible } })
}
function setPin(key: string, pin: Pin): void {
  patchState({ pins: { ...columnState.value.pins, [key]: pin } })
}
function handleColumnStateUpdate(value: DataGridUnifiedColumnState | null): void {
  if (value) columnState.value = value
}
function hideFlexibleColumns(): void {
  patchState({ visibility: { ...columnState.value.visibility, workstream: false, notes: false } })
}
function hideFixedColumns(): void {
  patchState({ visibility: Object.fromEntries(keys.map(key => [key, key === "workstream" || key === "notes"])) })
}
function pinWorkstream(): void {
  patchState({ visibility: { ...columnState.value.visibility, workstream: true }, pins: { ...columnState.value.pins, workstream: "left" } })
}
function moveWorkstreamToEnd(): void {
  const order = columnState.value.order.filter(key => key !== "workstream")
  patchState({ visibility: { ...columnState.value.visibility, workstream: true }, order: [...order, "workstream"] })
}
function resetState(): void {
  columnState.value = {
    ...initialState,
    order: [...initialState.order],
    visibility: { ...initialState.visibility },
    widths: { ...initialState.widths },
    pins: { ...initialState.pins },
  }
}

watch(columnState, async () => { await nextTick(); refreshMetrics() }, { deep: true })
onMounted(() => {
  refreshMetrics()
  const host = document.querySelector<HTMLElement>("[data-testid='column-flex-host']")
  if (host && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(refreshMetrics)
    host.querySelectorAll(".grid-header-viewport, .grid-cell--header[data-column-key]").forEach(element => {
      resizeObserver?.observe(element)
      if (element.matches(".grid-cell--header[data-column-key]")) observedHeaderCells.add(element)
    })
  }
  window.addEventListener("resize", refreshMetrics)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener("resize", refreshMetrics)
  cancelAnimationFrame(metricsFrame)
})
</script>

<style scoped>
.flex-demo { display: grid; flex: 1; grid-template-rows: auto auto auto minmax(0, 1fr); gap: 10px; min-height: 0; height: 100%; overflow: hidden; padding: 12px; color: #172033; }
.flex-demo__intro { max-width: 760px; }
.flex-demo__intro h2 { margin: 4px 0 8px; font-size: 24px; }
.flex-demo__intro p { margin: 0; color: #536179; }
.flex-demo__eyebrow { color: #2563eb !important; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.flex-demo__controls { display: grid; gap: 12px; max-width: 980px; }
.flex-demo__presets { display: flex; flex-wrap: wrap; gap: 8px; }
.flex-demo button, .flex-demo select { min-height: 32px; padding: 4px 9px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; color: #172033; }
.flex-demo button { cursor: pointer; }
.flex-demo__column-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.flex-demo__column-control { display: flex; align-items: center; gap: 6px; padding: 5px 7px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; }
.flex-demo__column-control small { color: #64748b; }
.flex-demo__column-control select { min-height: 26px; padding-block: 1px; font-size: 11px; }
.flex-demo__metrics { display: flex; flex-wrap: wrap; gap: 20px; margin: 0; padding: 10px 12px; border-radius: 8px; background: #f1f5f9; width: fit-content; }
.flex-demo__metrics div { min-width: 110px; }
.flex-demo__metrics dt { color: #64748b; font-size: 11px; }
.flex-demo__metrics dd { margin: 2px 0 0; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.flex-demo__metric--gap dd { color: #b91c1c; }
.flex-demo__host { display: flex; width: min(980px, 100%); min-width: 0; min-height: 0; border: 1px solid #94a3b8; border-radius: 8px; overflow: hidden; }
.flex-demo__host :deep(.affino-datagrid-app-root) { min-width: 0; }
</style>
