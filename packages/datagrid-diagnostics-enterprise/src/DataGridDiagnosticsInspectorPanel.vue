<template>
  <section class="datagrid-diagnostics-inspector">
    <header class="datagrid-diagnostics-inspector__header">
      <div>
        <div class="datagrid-diagnostics-inspector__eyebrow">Diagnostics</div>
        <h3 class="datagrid-diagnostics-inspector__title">Inspector</h3>
      </div>
      <div class="datagrid-diagnostics-inspector__actions">
        <button
          type="button"
          class="datagrid-diagnostics-inspector__secondary"
          @click="emit('refresh')"
        >
          Refresh
        </button>
        <button
          type="button"
          class="datagrid-diagnostics-inspector__ghost"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </header>

    <nav
      v-if="availableTabs.length > 0"
      class="datagrid-diagnostics-inspector__tabs"
      aria-label="Diagnostics tabs"
      @keydown="handleTabKeydown"
    >
      <button
        v-for="tab in availableTabs"
        :key="tab.id"
        :ref="element => registerTabButton(tab.id, element)"
        type="button"
        class="datagrid-diagnostics-inspector__tab"
        :class="{ 'datagrid-diagnostics-inspector__tab--active': activeTab === tab.id }"
        :data-datagrid-diagnostics-tab="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="datagrid-diagnostics-inspector__body">
      <section
        v-if="stickySummaryItems.length > 0"
        class="datagrid-diagnostics-inspector__status"
      >
        <div
          v-for="item in stickySummaryItems"
          :key="item.label"
          class="datagrid-diagnostics-inspector__status-chip"
        >
          <span class="datagrid-diagnostics-inspector__status-label">{{ item.label }}</span>
          <strong class="datagrid-diagnostics-inspector__status-value">{{ item.value }}</strong>
        </div>
      </section>

      <section
        v-if="activeTab === 'overview' && overviewRows.length > 0"
        class="datagrid-diagnostics-inspector__section"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">Overview</div>
        <dl class="datagrid-diagnostics-inspector__summary-grid">
          <template v-for="row in overviewRows" :key="row.label">
            <dt class="datagrid-diagnostics-inspector__summary-label">{{ row.label }}</dt>
            <dd class="datagrid-diagnostics-inspector__summary-value">{{ row.value }}</dd>
          </template>
        </dl>
      </section>

      <section
        v-if="activeTab === 'license' && licenseSummaryRows.length > 0"
        class="datagrid-diagnostics-inspector__section"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">License</div>
        <dl class="datagrid-diagnostics-inspector__summary-grid">
          <template v-for="row in licenseSummaryRows" :key="row.label">
            <dt class="datagrid-diagnostics-inspector__summary-label">{{ row.label }}</dt>
            <dd class="datagrid-diagnostics-inspector__summary-value">{{ row.value }}</dd>
          </template>
        </dl>
      </section>

      <section
        v-if="activeTab === 'performance' && performanceSummaryRows.length > 0"
        class="datagrid-diagnostics-inspector__section"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">Performance policy</div>
        <dl class="datagrid-diagnostics-inspector__summary-grid">
          <template v-for="row in performanceSummaryRows" :key="row.label">
            <dt class="datagrid-diagnostics-inspector__summary-label">{{ row.label }}</dt>
            <dd class="datagrid-diagnostics-inspector__summary-value">{{ row.value }}</dd>
          </template>
        </dl>
      </section>

      <section
        v-if="activeTab === 'formula' && formulaSummaryRows.length > 0"
        class="datagrid-diagnostics-inspector__section"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">Formula explain</div>
        <dl class="datagrid-diagnostics-inspector__summary-grid">
          <template v-for="row in formulaSummaryRows" :key="row.label">
            <dt class="datagrid-diagnostics-inspector__summary-label">{{ row.label }}</dt>
            <dd class="datagrid-diagnostics-inspector__summary-value">{{ row.value }}</dd>
          </template>
        </dl>
      </section>

      <section
        v-if="activeTab === 'traces' && traceHistory.length > 0"
        class="datagrid-diagnostics-inspector__section"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">Recent traces</div>
        <ol class="datagrid-diagnostics-inspector__trace-list">
          <li
            v-for="entry in traceHistory"
            :key="entry.id"
            class="datagrid-diagnostics-inspector__trace-item"
          >
            <div class="datagrid-diagnostics-inspector__trace-header">
              <strong class="datagrid-diagnostics-inspector__trace-source">{{ entry.sourceLabel }}</strong>
              <span class="datagrid-diagnostics-inspector__trace-time">{{ entry.capturedAtLabel }}</span>
            </div>
            <div class="datagrid-diagnostics-inspector__trace-meta">
              rev {{ formatNullable(entry.rowRevision) }},
              rows {{ entry.rowCount }},
              compute {{ entry.configuredComputeMode }} -> {{ entry.effectiveComputeMode }},
              dispatch {{ formatNullable(entry.dispatchCount) }},
              fallback {{ formatNullable(entry.fallbackCount) }}
            </div>
            <div class="datagrid-diagnostics-inspector__trace-meta">
              touched {{ formatNullable(entry.rowsTouched) }},
              changed {{ formatNullable(entry.changedRows) }},
              dirty {{ entry.dirtyNodeCount }},
              errors {{ entry.runtimeErrorCount }}
            </div>
            <div class="datagrid-diagnostics-inspector__trace-meta">
              formulas
              {{ entry.hotFormulaFields.length > 0 ? entry.hotFormulaFields.join(", ") : "none" }}
            </div>
          </li>
        </ol>
      </section>

      <section
        v-if="activeTab === 'raw'"
        class="datagrid-diagnostics-inspector__section datagrid-diagnostics-inspector__section--raw"
      >
        <div class="datagrid-diagnostics-inspector__section-eyebrow">Raw snapshot</div>
        <pre class="datagrid-diagnostics-inspector__snapshot">{{ formattedSnapshot }}</pre>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from "vue"
import { ensureDataGridDiagnosticsEnterpriseStyles } from "./ensureDataGridDiagnosticsEnterpriseStyles"

ensureDataGridDiagnosticsEnterpriseStyles()

interface DataGridDiagnosticsPerformanceSummary {
  policyLabel: string
  runtimeSourceLabel: string
  configuredComputeMode: string
  workerPatchDispatchThreshold: number | null
  formulaColumnCacheMaxColumns: number | null
  virtualization: {
    rows: boolean | null
    columns: boolean | null
    rowOverscan: number | null
    columnOverscan: number | null
  } | null
}

interface DataGridDiagnosticsFormulaSummary {
  formulaCount: number
  executionLevels: number
  recomputedFieldCount: number
  runtimeErrorCount: number
  rowsTouched: number | null
  changedRows: number | null
  dirtyNodeCount: number
  hotFormulaFields: readonly string[]
}

interface DataGridDiagnosticsTraceEntry {
  id: string
  sourceLabel: string
  capturedAtLabel: string
  rowRevision: number | null
  rowCount: number
  configuredComputeMode: string
  effectiveComputeMode: string
  dispatchCount: number | null
  fallbackCount: number | null
  rowsTouched: number | null
  changedRows: number | null
  runtimeErrorCount: number
  dirtyNodeCount: number
  hotFormulaFields: readonly string[]
}

interface DataGridDiagnosticsLicenseSummary {
  status: "missing" | "invalid" | "expired" | "valid"
  statusLabel: string
  sourceLabel: string
  tier: "trial" | "enterprise" | null
  tierLabel: string
  customer: string | null
  expiresAt: string | null
  daysRemaining: number | null
  featureLabel: string
  isTrial: boolean
  isExpiringSoon: boolean
  isScoped: boolean
}

const props = withDefaults(defineProps<{
  snapshot: unknown | null
  licenseSummary?: DataGridDiagnosticsLicenseSummary | null
  performanceSummary?: DataGridDiagnosticsPerformanceSummary | null
  formulaSummary?: DataGridDiagnosticsFormulaSummary | null
  traceHistory?: readonly DataGridDiagnosticsTraceEntry[]
}>(), {
  licenseSummary: null,
  performanceSummary: null,
  formulaSummary: null,
  traceHistory: () => [],
})

const emit = defineEmits<{
  close: []
  refresh: []
}>()

type DiagnosticsTabId = "overview" | "license" | "performance" | "formula" | "traces" | "raw"

const activeTab = ref<DiagnosticsTabId>("overview")
const tabButtonRefs = ref<Partial<Record<DiagnosticsTabId, HTMLButtonElement | null>>>({})

const formattedSnapshot = computed(() => {
  if (!props.snapshot) {
    return "No diagnostics snapshot"
  }
  return JSON.stringify(props.snapshot, null, 2)
})

const performanceSummaryRows = computed(() => {
  const summary = props.performanceSummary
  const snapshotCompute = readSnapshotCompute(props.snapshot)
  if (!summary) {
    return []
  }

  return [
    { label: "Performance preset", value: summary.policyLabel },
    { label: "Runtime source", value: summary.runtimeSourceLabel },
    {
      label: "Configured compute mode",
      value: snapshotCompute?.configuredMode ?? summary.configuredComputeMode,
    },
    {
      label: "Effective compute mode",
      value: snapshotCompute?.effectiveMode ?? summary.configuredComputeMode,
    },
    {
      label: "Worker patch threshold",
      value: formatNumberValue(summary.workerPatchDispatchThreshold),
    },
    {
      label: "Formula cache max columns",
      value: formatNumberValue(summary.formulaColumnCacheMaxColumns),
    },
    {
      label: "Virtualization",
      value: formatVirtualizationSummary(summary.virtualization),
    },
  ]
})

const formulaSummaryRows = computed(() => {
  const summary = props.formulaSummary
  if (!summary) {
    return []
  }

  return [
    { label: "Formula fields", value: String(summary.formulaCount) },
    { label: "Execution levels", value: String(summary.executionLevels) },
    { label: "Recomputed fields", value: String(summary.recomputedFieldCount) },
    { label: "Runtime errors", value: String(summary.runtimeErrorCount) },
    { label: "Rows touched", value: formatNumberValue(summary.rowsTouched) },
    { label: "Changed rows", value: formatNumberValue(summary.changedRows) },
    { label: "Dirty nodes", value: String(summary.dirtyNodeCount) },
    {
      label: "Active formulas",
      value: summary.hotFormulaFields.length > 0 ? summary.hotFormulaFields.join(", ") : "none",
    },
  ]
})

const licenseSummaryRows = computed(() => {
  const summary = props.licenseSummary
  if (!summary) {
    return []
  }

  return [
    { label: "License status", value: summary.statusLabel },
    { label: "License tier", value: summary.tierLabel },
    { label: "License source", value: summary.sourceLabel },
    { label: "Customer", value: summary.customer ?? "-" },
    { label: "Expires", value: summary.expiresAt ?? "-" },
    {
      label: "Days remaining",
      value: summary.daysRemaining !== null ? String(summary.daysRemaining) : "-",
    },
    { label: "Feature claims", value: summary.featureLabel },
  ]
})

const availableTabs = computed<readonly { id: DiagnosticsTabId; label: string }[]>(() => {
  const tabs: Array<{ id: DiagnosticsTabId; label: string }> = []
  if (overviewRows.value.length > 0) {
    tabs.push({ id: "overview", label: "Overview" })
  }
  if (licenseSummaryRows.value.length > 0) {
    tabs.push({ id: "license", label: "License" })
  }
  if (performanceSummaryRows.value.length > 0) {
    tabs.push({ id: "performance", label: "Performance" })
  }
  if (formulaSummaryRows.value.length > 0) {
    tabs.push({ id: "formula", label: "Formula" })
  }
  if (props.traceHistory.length > 0) {
    tabs.push({ id: "traces", label: "Traces" })
  }
  tabs.push({ id: "raw", label: "Raw" })
  return tabs
})

const overviewRows = computed(() => {
  const latestTrace = props.traceHistory[0] ?? null
  const rows: Array<{ label: string; value: string }> = []

  if (props.performanceSummary) {
    rows.push(
      { label: "License status", value: props.licenseSummary?.statusLabel ?? "Community" },
      { label: "Performance preset", value: props.performanceSummary.policyLabel },
      { label: "Configured compute mode", value: readSnapshotCompute(props.snapshot)?.configuredMode ?? props.performanceSummary.configuredComputeMode },
    )
  } else if (props.licenseSummary) {
    rows.push(
      { label: "License status", value: props.licenseSummary.statusLabel },
      { label: "License tier", value: props.licenseSummary.tierLabel },
    )
  }

  if (props.formulaSummary) {
    rows.push(
      { label: "Formula fields", value: String(props.formulaSummary.formulaCount) },
      { label: "Dirty nodes", value: String(props.formulaSummary.dirtyNodeCount) },
    )
  }

  if (latestTrace) {
    rows.push(
      { label: "Latest trace", value: latestTrace.sourceLabel },
      { label: "Latest revision", value: formatNullable(latestTrace.rowRevision) },
      { label: "Latest rows touched", value: formatNullable(latestTrace.rowsTouched) },
    )
  }

  return rows
})

const stickySummaryItems = computed(() => {
  const latestTrace = props.traceHistory[0] ?? null
  const items: Array<{ label: string; value: string }> = []

  if (props.performanceSummary) {
    items.push({
      label: "Preset",
      value: props.performanceSummary.policyLabel,
    })
  }

  const computeMode = readSnapshotCompute(props.snapshot)?.effectiveMode
    ?? props.performanceSummary?.configuredComputeMode
    ?? null
  if (computeMode) {
    items.push({
      label: "Compute",
      value: computeMode,
    })
  }

  if (latestTrace) {
    items.push({
      label: "Latest trace",
      value: latestTrace.sourceLabel,
    })
  }

  if (props.licenseSummary && props.licenseSummary.status !== "missing") {
    items.unshift({
      label: "License",
      value: props.licenseSummary.isTrial
        ? "trial"
        : props.licenseSummary.status === "valid"
          ? "active"
          : props.licenseSummary.status,
    })
  }

  return items
})

watch(availableTabs, nextTabs => {
  if (nextTabs.some(tab => tab.id === activeTab.value)) {
    return
  }
  activeTab.value = nextTabs[0]?.id ?? "overview"
}, { immediate: true })

function registerTabButton(
  tabId: DiagnosticsTabId,
  element: Element | ComponentPublicInstance | null,
): void {
  tabButtonRefs.value[tabId] = element instanceof HTMLButtonElement ? element : null
}

function focusTab(tabId: DiagnosticsTabId): void {
  tabButtonRefs.value[tabId]?.focus()
}

function handleTabKeydown(event: KeyboardEvent): void {
  const tabIds = availableTabs.value.map(tab => tab.id)
  if (tabIds.length === 0) {
    return
  }

  const currentIndex = Math.max(0, tabIds.indexOf(activeTab.value))
  let nextIndex = currentIndex

  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabIds.length
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length
  } else if (event.key === "Home") {
    nextIndex = 0
  } else if (event.key === "End") {
    nextIndex = tabIds.length - 1
  } else {
    return
  }

  event.preventDefault()
  const nextTabId = tabIds[nextIndex] ?? tabIds[0]
  activeTab.value = nextTabId
  focusTab(nextTabId)
}

function readSnapshotCompute(snapshot: unknown): {
  configuredMode?: string | null
  effectiveMode?: string | null
} | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null
  }
  const compute = (snapshot as { compute?: unknown }).compute
  if (!compute || typeof compute !== "object") {
    return null
  }
  return compute as {
    configuredMode?: string | null
    effectiveMode?: string | null
  }
}

function formatNumberValue(value: number | null): string {
  return typeof value === "number" ? String(value) : "default"
}

function formatNullable(value: number | null): string {
  return typeof value === "number" ? String(value) : "-"
}

function formatVirtualizationSummary(
  value: DataGridDiagnosticsPerformanceSummary["virtualization"],
): string {
  if (!value) {
    return "community defaults"
  }

  const rows = typeof value.rows === "boolean" ? (value.rows ? "on" : "off") : "default"
  const columns = typeof value.columns === "boolean" ? (value.columns ? "on" : "off") : "default"
  const rowOverscan = typeof value.rowOverscan === "number" ? String(value.rowOverscan) : "default"
  const columnOverscan = typeof value.columnOverscan === "number"
    ? String(value.columnOverscan)
    : "default"

  return `rows ${rows}, columns ${columns}, rowOverscan ${rowOverscan}, columnOverscan ${columnOverscan}`
}
</script>
