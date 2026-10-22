import type { DataGridColumnInput } from "@affino/datagrid-core"

export interface Order {
  id: string
  customer: string
  status: "open" | "paid" | "cancelled"
  amount: number
}

// The core column model accepts framework-neutral field metadata. The host
// keeps the strongly typed row contract and supplies row identity separately.
export const columns: DataGridColumnInput[] = [
  { key: "customer", field: "customer", label: "Customer" },
  { key: "status", field: "status", label: "Status" },
  { key: "amount", field: "amount", label: "Amount" },
]
