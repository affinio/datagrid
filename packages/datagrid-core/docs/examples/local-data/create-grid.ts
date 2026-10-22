import {
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
} from "@affino/datagrid-core"
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"
import { columns, type Order } from "./schema.js"
import { rows } from "./rows.js"

const rowModel = createAdvancedClientRowModel<Order>({
  rows,
  resolveRowId: row => row.id,
})
const columnModel = createDataGridColumnModel({ columns })
const core = createDataGridCore({
  services: {
    rowModel: { name: "rowModel", model: rowModel },
    columnModel: { name: "columnModel", model: columnModel },
  },
})

export const api = createDataGridApi<Order>({ core })

export async function startGrid(): Promise<void> {
  await api.start()
}

export async function disposeGrid(): Promise<void> {
  await api.dispose()
  rowModel.dispose()
  columnModel.dispose()
}
