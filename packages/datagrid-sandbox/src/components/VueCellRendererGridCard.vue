<template>
  <article ref="cardRootRef" class="card renderer-card affino-datagrid-app-root">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>Vue: Cell Renderer</h2>
          <p class="renderer-card__subtitle">
            Status and approval cells are rendered through the new public column <code>cellRenderer</code> API.
          </p>
        </div>
        <div class="mode-badge">Custom cells</div>
      </div>
      <div class="meta">
        <span>Rows: {{ rows.length }}</span>
        <span>Rendered as Vue content inside standard grid cells</span>
      </div>
    </header>

    <div class="renderer-card__surface">
      <DataGrid
        :rows="rows"
        :columns="columns"
        :client-row-model-options="clientRowModelOptions"
        :theme="theme"
        :show-row-index="false"
        :row-selection="false"
        :aggregations="false"
        :base-row-height="34"
        row-height-mode="fixed"
        row-hover
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, defineComponent, type PropType } from "vue"
import { applyGridTheme, industrialNeutralTheme } from "@affino/datagrid-theme"
import { DataGrid, type DataGridAppColumnInput } from "@affino/datagrid-vue-app"

type RendererTone = "neutral" | "info" | "warning" | "success" | "danger"

interface RendererDemoRow {
  id: string
  period: string
  employee: string
  status: string
  statusTone: RendererTone
  hours: number
  approval: string
  approvalTone: RendererTone
}

const StatusChip = defineComponent({
  name: "SandboxStatusChip",
  props: {
    label: {
      type: String,
      required: true,
    },
    tone: {
      type: String as PropType<RendererTone>,
      required: true,
    },
  },
  setup(props) {
    return () => h("span", {
      class: ["renderer-status-chip", `renderer-status-chip--${props.tone}`],
    }, props.label)
  },
})

const rows = ref<RendererDemoRow[]>([
  {
    id: "week-2026-03-23",
    period: "Mon 23 Mar - Sun 29 Mar",
    employee: "Maya Patel",
    status: "Missing",
    statusTone: "danger",
    hours: 0,
    approval: "Draft not submitted",
    approvalTone: "neutral",
  },
  {
    id: "week-2026-03-16",
    period: "Mon 16 Mar - Sun 22 Mar",
    employee: "Maya Patel",
    status: "Submitted",
    statusTone: "info",
    hours: 37,
    approval: "Waiting for approval",
    approvalTone: "info",
  },
  {
    id: "week-2026-03-09",
    period: "Mon 9 Mar - Sun 15 Mar",
    employee: "Maya Patel",
    status: "Needs action",
    statusTone: "warning",
    hours: 32,
    approval: "Changes requested",
    approvalTone: "warning",
  },
  {
    id: "week-2026-03-02",
    period: "Mon 2 Mar - Sun 8 Mar",
    employee: "Maya Patel",
    status: "Approved",
    statusTone: "success",
    hours: 40,
    approval: "Approved on 10 Mar",
    approvalTone: "success",
  },
])

const columns = computed<readonly DataGridAppColumnInput<RendererDemoRow>[]>(() => [
  {
    key: "period",
    label: "Week",
    minWidth: 220,
    flex: 1.2,
    capabilities: { editable: false },
  },
  {
    key: "employee",
    label: "Employee",
    minWidth: 160,
    flex: 1,
    capabilities: { editable: false },
  },
  {
    key: "status",
    label: "Status",
    minWidth: 150,
    flex: 0.8,
    capabilities: { editable: false },
    cellRenderer: ({ row, displayValue }) => h(StatusChip, {
      label: displayValue,
      tone: row?.statusTone ?? "neutral",
    }),
  },
  {
    key: "hours",
    label: "Hours",
    dataType: "number",
    minWidth: 90,
    flex: 0.45,
    capabilities: { editable: false },
    presentation: {
      align: "right",
      headerAlign: "right",
      numberFormat: {
        locale: "en-GB",
        maximumFractionDigits: 1,
      },
    },
  },
  {
    key: "approval",
    label: "Approval",
    minWidth: 190,
    flex: 1,
    capabilities: { editable: false },
    cellRenderer: ({ row, displayValue }) => h(StatusChip, {
      label: displayValue,
      tone: row?.approvalTone ?? "neutral",
    }),
  },
])

const clientRowModelOptions = {
  resolveRowId: (row: RendererDemoRow) => row.id,
}

const theme = industrialNeutralTheme
const cardRootRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (cardRootRef.value) {
    applyGridTheme(cardRootRef.value, theme)
  }
})

onUnmounted(() => {
  if (cardRootRef.value) {
    applyGridTheme(cardRootRef.value, null)
  }
})
</script>

<style>
.renderer-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 640px;
}

.renderer-card__subtitle {
  margin: 0.35rem 0 0;
  color: #53636c;
  font-size: 0.95rem;
}

.renderer-card__surface {
  min-height: 0;
  border-radius: 1rem;
  overflow: hidden;
}

.renderer-card__surface :deep(.affino-datagrid-app-root),
.renderer-card__surface :deep(.grid-root),
.renderer-card__surface :deep(.grid-viewport),
.renderer-card__surface :deep(.grid-pane),
.renderer-card__surface :deep(.grid-body-viewport.table-wrap),
.renderer-card__surface :deep(.table-wrap),
.renderer-card__surface :deep(.grid-body-content),
.renderer-card__surface :deep(.grid-pane-content) {
  min-height: 0;
  height: 100%;
}

.renderer-status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0.18rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.renderer-status-chip--neutral {
  color: #43515c;
  background: rgba(236, 240, 243, 0.92);
  border-color: rgba(196, 205, 213, 0.85);
}

.renderer-status-chip--info {
  color: #135985;
  background: rgba(225, 240, 250, 0.95);
  border-color: rgba(168, 204, 226, 0.9);
}

.renderer-status-chip--warning {
  color: #8a4a09;
  background: rgba(253, 244, 212, 0.96);
  border-color: rgba(231, 204, 138, 0.92);
}

.renderer-status-chip--success {
  color: #165c3d;
  background: rgba(225, 245, 233, 0.96);
  border-color: rgba(163, 210, 180, 0.92);
}

.renderer-status-chip--danger {
  color: #a03232;
  background: rgba(252, 233, 233, 0.96);
  border-color: rgba(231, 181, 181, 0.92);
}
</style>
