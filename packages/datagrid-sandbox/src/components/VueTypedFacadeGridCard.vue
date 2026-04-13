<script lang="ts">
import { computed, defineComponent, h, ref, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import {
  defineDataGridColumns,
  defineDataGridComponent,
  defineDataGridFilterCellReader,
  defineDataGridSelectionCellReader,
  useDataGridRef,
  type DataGridAppClientRowModelOptions,
} from "@affino/datagrid-vue-app"
import type { DataGridUnifiedState } from "@affino/datagrid-vue"

interface TypedFacadeRow {
  id: string
  owner: string
  statusCode: "a" | "b"
  formula: string
  effectiveAmount: number
}

type TypedFacadeStatusTone = "success" | "danger"

const TypedDataGrid = defineDataGridComponent<TypedFacadeRow>()

const TypedFacadeStatusChip = defineComponent({
  name: "TypedFacadeStatusChip",
  props: {
    label: {
      type: String,
      required: true,
    },
    tone: {
      type: String as () => TypedFacadeStatusTone,
      required: true,
    },
  },
  setup(props) {
    return () => h("span", {
      class: ["typed-facade-status-chip", `typed-facade-status-chip--${props.tone}`],
    }, props.label)
  },
})

const columns = defineDataGridColumns<TypedFacadeRow>()([
  {
    key: "owner",
    label: "Owner",
    minWidth: 170,
    flex: 1.15,
  },
  {
    key: "status",
    field: "statusCode",
    label: "Status",
    minWidth: 140,
    flex: 0.9,
    valueGetter: row => row.statusCode === "a" ? "Active" : "Blocked",
    cellRenderer: ({ row }) => h(TypedFacadeStatusChip, {
      label: row?.statusCode === "a" ? "Active" : "Blocked",
      tone: row?.statusCode === "a" ? "success" : "danger",
    }),
  },
  {
    key: "formula",
    label: "Formula",
    minWidth: 170,
    flex: 1.1,
  },
] as const)

const readFilterCell = defineDataGridFilterCellReader<TypedFacadeRow>()((row, columnKey) => {
  if (columnKey !== "status") {
    return undefined
  }
  return row.data.statusCode === "a" ? "Active" : "Blocked"
})

const readSelectionCell = defineDataGridSelectionCellReader<TypedFacadeRow>()((row, columnKey) => {
  if (columnKey !== "formula") {
    return undefined
  }
  return row.data.effectiveAmount
})

const clientRowModelOptions = {
  resolveRowId: row => row.id,
} satisfies DataGridAppClientRowModelOptions<TypedFacadeRow>

export default defineComponent({
  name: "VueTypedFacadeGridCard",
  setup() {
    const rows = ref<readonly TypedFacadeRow[]>([
      { id: "tf-1", owner: "North Ops", statusCode: "a", formula: "=12+18", effectiveAmount: 30 },
      { id: "tf-2", owner: "Billing", statusCode: "b", formula: "=20+5", effectiveAmount: 25 },
      { id: "tf-3", owner: "Platform", statusCode: "a", formula: "=14+16", effectiveAmount: 30 },
    ])
    const gridRef = useDataGridRef<TypedFacadeRow>()
    const cardRootRef = ref<HTMLElement | null>(null)
    const lastFilterModel = ref("null")
    const lastSelectionSummary = ref("null")
    const themeTokens = resolveGridThemeTokens(industrialNeutralTheme)

    watchEffect(() => {
      if (cardRootRef.value) {
        applyGridTheme(cardRootRef.value, themeTokens)
      }
    })

    const firstRowLabel = computed(() => {
      return gridRef.value?.getApi?.()?.rows.get(0)?.data?.owner ?? "n/a"
    })

    const writeLastFilterModel = (filterModel: unknown): void => {
      const serialized = JSON.stringify(filterModel ?? null, null, 2)
      if (lastFilterModel.value !== serialized) {
        lastFilterModel.value = serialized
      }
    }

    const writeLastSelectionSummary = (summary: unknown): void => {
      const serialized = JSON.stringify(summary ?? null, null, 2)
      if (lastSelectionSummary.value !== serialized) {
        lastSelectionSummary.value = serialized
      }
    }

    const handleStateUpdate = (nextState: DataGridUnifiedState<TypedFacadeRow> | null): void => {
      writeLastFilterModel(nextState?.rows?.snapshot?.filterModel ?? null)
    }

    const captureFilterModel = (): void => {
      const state = gridRef.value?.getState?.() as DataGridUnifiedState<TypedFacadeRow> | null | undefined
      writeLastFilterModel(state?.rows?.snapshot?.filterModel ?? null)
    }

    const captureSelectionSummary = (): void => {
      const summary = gridRef.value?.getApi?.()?.selection.summarize?.({
        readSelectionCell,
      }) ?? null
      writeLastSelectionSummary(summary)
    }

    const promoteBlockedInvoice = (): void => {
      gridRef.value?.getApi?.()?.rows.applyEdits?.([
        {
          rowId: "tf-2",
          data: {
            statusCode: "a",
            effectiveAmount: 55,
          },
        },
      ])
      captureFilterModel()
      captureSelectionSummary()
    }

    return () => h("article", {
      ref: cardRootRef,
      class: "card typed-facade-card affino-datagrid-app-root",
    }, [
      h("header", { class: "card__header" }, [
        h("div", { class: "card__title-row" }, [
          h("div", [
            h("h2", "Vue: Typed Facade"),
            h("p", { class: "typed-facade-card__subtitle" }, "Typed columns, typed readers, typed ref, and typed h()-rendered DataGrid all flow through one explicit row contract."),
          ]),
          h("div", { class: "mode-badge" }, "Typed API"),
        ]),
        h("div", { class: "meta" }, [
          h("span", `First row from typed api.rows.get(): ${firstRowLabel.value}`),
          h("span", "Open the Status column menu to inspect readFilterCell output, then select Formula cells and capture a typed summary."),
        ]),
      ]),
      h("div", { class: "typed-facade-card__controls" }, [
        h("button", {
          type: "button",
          class: "typed-facade-card__button",
          onClick: captureFilterModel,
        }, "Capture typed filter model"),
        h("button", {
          type: "button",
          class: "typed-facade-card__button",
          onClick: captureSelectionSummary,
        }, "Capture typed selection summary"),
        h("button", {
          type: "button",
          class: "typed-facade-card__button typed-facade-card__button--accent",
          onClick: promoteBlockedInvoice,
        }, "Promote blocked invoice via typed API"),
      ]),
      h("div", { class: "typed-facade-card__surface" }, [
        h(TypedDataGrid, {
          ref: gridRef,
          rows: rows.value,
          columns,
          columnMenu: true,
          showRowIndex: false,
          rowSelection: false,
          layoutMode: "auto-height",
          minRows: 5,
          maxRows: 6,
          baseRowHeight: 34,
          rowHeightMode: "fixed",
          rowHover: true,
          readFilterCell,
          readSelectionCell,
          clientRowModelOptions,
          "onUpdate:state": handleStateUpdate,
        }),
      ]),
      h("section", { class: "typed-facade-card__inspectors" }, [
        h("div", { class: "typed-facade-card__inspector" }, [
          h("h3", "Last filter model"),
          h("pre", lastFilterModel.value),
        ]),
        h("div", { class: "typed-facade-card__inspector" }, [
          h("h3", "Last selection summary"),
          h("pre", lastSelectionSummary.value),
        ]),
      ]),
    ])
  },
})
</script>

<style>
.typed-facade-card {
  display: grid;
  gap: 18px;
  align-content: start;
}

.typed-facade-card__subtitle {
  max-width: 72ch;
}

.typed-facade-card__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.typed-facade-card__button {
  border: 1px solid color-mix(in srgb, var(--datagrid-accent-strong, #335c4b) 24%, transparent);
  background: color-mix(in srgb, var(--datagrid-header-cell-bg, #f5f2eb) 88%, white);
  color: var(--datagrid-foreground, #18221d);
  border-radius: 999px;
  padding: 8px 14px;
  font: inherit;
  cursor: pointer;
}

.typed-facade-card__button--accent {
  background: var(--datagrid-accent-strong, #335c4b);
  color: white;
  border-color: transparent;
}

.typed-facade-status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0.18rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.typed-facade-status-chip--success {
  color: #165c3d;
  background: rgba(225, 245, 233, 0.96);
  border-color: rgba(163, 210, 180, 0.92);
}

.typed-facade-status-chip--danger {
  color: #a03232;
  background: rgba(252, 233, 233, 0.96);
  border-color: rgba(231, 181, 181, 0.92);
}

.typed-facade-card__surface {
  min-height: 300px;
}

.typed-facade-card__inspectors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.typed-facade-card__inspector {
  border: 1px solid color-mix(in srgb, var(--datagrid-accent-strong, #335c4b) 14%, transparent);
  border-radius: 16px;
  padding: 14px;
  background: color-mix(in srgb, var(--datagrid-header-cell-bg, #f5f2eb) 48%, white);
}

.typed-facade-card__inspector h3 {
  margin: 0 0 8px;
  font-size: 0.92rem;
}

.typed-facade-card__inspector pre {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>