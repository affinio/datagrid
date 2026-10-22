import type { Order } from "./schema.js"

export const rows: readonly Order[] = [
  { id: "order-101", customer: "A. Chen", status: "open", amount: 120 },
  { id: "order-102", customer: "M. Diaz", status: "paid", amount: 85 },
  { id: "order-103", customer: "S. Ivanov", status: "open", amount: 240 },
]
