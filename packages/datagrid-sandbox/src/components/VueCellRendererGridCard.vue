<template>
  <article ref="cardRootRef" class="card renderer-card affino-datagrid-app-root">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>Vue: Cell Renderer</h2>
          <p class="renderer-card__subtitle">
            Status chips and an inline approval action are rendered through the public <code>cellRenderer</code> + <code>cellInteraction</code> column APIs.
          </p>
        </div>
        <div class="mode-badge">Custom cells</div>
      </div>
      <div class="meta">
        <span>Rows: {{ rows.length }}</span>
        <span>Enter, Space, or click the action pill to toggle approval</span>
      </div>
    </header>

    <div class="renderer-card__surface">
      <DataGrid
        :rows="rows"
        :columns="columns"
        layout-mode="auto-height"
        :min-rows="6"
        :max-rows="8"
        fill-handle
        range-move
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
import { computed, h, ref, watchEffect, defineComponent, type PropType } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
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
  approved: boolean
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
    approved: false,
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
    approved: false,
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
    approved: false,
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
    approved: true,
  },
])

function toggleApproval(rowId: string | number | null | undefined): void {
  if (rowId == null) {
    return
  }
  rows.value = rows.value.map(row => {
    if (row.id !== String(rowId)) {
      return row
    }
    if (row.approved) {
      return {
        ...row,
        approved: false,
        status: "Needs action",
        statusTone: "warning",
        approval: "Reopened for review",
        approvalTone: "warning",
      }
    }
    return {
      ...row,
      approved: true,
      status: "Approved",
      statusTone: "success",
      approval: "Approved just now",
      approvalTone: "success",
    }
  })
}

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
  {
    key: "approvalAction",
    label: "Action",
    minWidth: 160,
    flex: 0.75,
    capabilities: { editable: false },
    cellInteraction: {
      click: true,
      keyboard: ["enter", "space"],
      role: "button",
      label: ({ row }) => row?.approved ? "Reopen approval" : "Approve timesheet",
      pressed: ({ row }) => row?.approved === true,
      onInvoke: ({ rowId }) => {
        toggleApproval(rowId)
      },
    },
    cellRenderer: ({ row, interactive }) => h("button", {
      type: "button",
      class: [
        "renderer-action-pill",
        row?.approved ? "renderer-action-pill--active" : "renderer-action-pill--idle",
      ],
      disabled: interactive?.enabled === false,
      "aria-pressed": interactive?.ariaPressed,
      onClick: (event: MouseEvent) => {
        event.stopPropagation()
        interactive?.activate("click")
      },
    }, row?.approved ? "Reopen" : "Approve"),
  },
])

const clientRowModelOptions = {
  resolveRowId: (row: RendererDemoRow) => row.id,
}

const theme = industrialNeutralTheme
const cardRootRef = ref<HTMLElement | null>(null)
const sandboxThemeTokens = resolveGridThemeTokens(theme)

watchEffect(() => {
  if (cardRootRef.value) {
    applyGridTheme(cardRootRef.value, sandboxThemeTokens)
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

.renderer-action-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.9rem;
  min-width: 6.5rem;
  padding: 0.28rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
}

.renderer-action-pill:hover {
  transform: translateY(-1px);
}

.renderer-action-pill:focus-visible {
  outline: 2px solid rgba(15, 113, 178, 0.35);
  outline-offset: 2px;
}

.renderer-action-pill--idle {
  color: #0b5b7f;
  background: linear-gradient(180deg, rgba(226, 245, 252, 0.98), rgba(199, 231, 244, 0.95));
  border-color: rgba(133, 189, 214, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.renderer-action-pill--active {
  color: #175138;
  background: linear-gradient(180deg, rgba(231, 247, 236, 0.98), rgba(200, 231, 211, 0.96));
  border-color: rgba(130, 187, 149, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
}
</style>
