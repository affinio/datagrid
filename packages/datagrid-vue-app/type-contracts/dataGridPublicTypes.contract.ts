import {
  defineDataGridColumnMenu,
  defineDataGridColumns,
  type DataGridAppColumnInput,
  type DataGridColumnMenuProp,
} from "../src/index"

interface GridLotRow {
  id: string
  lotName: string
  analysisLabel: string
  roiValue: number
}

const valueFilterColumnKeys = new Set(["analysisLabel"])

const typedColumns = defineDataGridColumns<GridLotRow>()([
  {
    key: "lotName",
    label: "Lot",
    cellRenderer: ({ row }) => row?.lotName ?? "",
  },
  {
    key: "analysisLabel",
    label: "Signal",
    capabilities: { sortable: true, filterable: true },
  },
  {
    key: "roiValue",
    label: "ROI",
    dataType: "number",
    filter: {
      normalizeValue: ({ value }) => typeof value === "number" ? value / 100 : value,
    },
  },
])

const columnsForComponentProp: readonly DataGridAppColumnInput[] = typedColumns

const columnMenuOptions = defineDataGridColumnMenu({
  trigger: "button+contextmenu",
  items: ["sort", "group", "pin", "filter"],
  labels: {
    sort: "Sort",
    filter: "Filter",
    valueSearchPlaceholder: "Search values",
  },
  actions: {
    sortAsc: { label: "Ascending" },
    clearFilter: { label: "Clear filter" },
  },
  columns: Object.fromEntries(
    typedColumns
      .map(column => String(column.key))
      .filter(key => !valueFilterColumnKeys.has(key))
      .map(key => [key, { hide: ["filter"] }]),
  ),
})

const columnMenuForComponentProp: DataGridColumnMenuProp = columnMenuOptions

void columnsForComponentProp
void columnMenuForComponentProp
