import type { DataGridAppColumnInput } from "@affino/datagrid-vue-app"
import type { DataGridDataSource } from "@affino/datagrid-vue"

export type ScenarioId = "scale" | "backend" | "spreadsheet" | "filters"

export type RevenueRow = {
  rowId: string
  account: string
  segment: string
  owner: string
  region: string
  stage: string
  risk: string
  arr: number
  margin: number
  renewal: string
  nextStep: string
}

export type CapacityRow = {
  rowId: string
  service: string
  region: string
  shard: string
  requests: number
  errors: number
  latencyP95: number
  cpu: number
  memory: number
  cost: number
  owner: string
  status: string
}

export type ForecastRow = {
  rowId: string
  product: string
  owner: string
  units: number
  price: number
  discount: number
  taxRate: number
  cost: number
  subtotal?: number
  tax?: number
  total?: number
  margin?: number
  marginPct?: number
}

const accounts = [
  "Northstar Bank",
  "Atlas Freight",
  "Keystone Health",
  "Harbor Retail",
  "Vector Labs",
  "Summit Energy",
  "Cobalt Systems",
  "Pioneer Foods",
  "Apex Mobility",
  "Meridian Cloud",
]

const owners = ["A. Chen", "M. Silva", "J. Okafor", "N. Patel", "R. Meyer"]
const regions = ["NA", "EMEA", "APAC", "LATAM"]
const stages = ["Expansion", "Renewal", "Implementation", "Executive review", "Procurement"]
const risks = ["Low", "Medium", "High"]
const nextSteps = ["Finalize rollout plan", "Review adoption report", "Schedule stakeholder call", "Confirm security review", "Approve commercial terms"]
const services = ["Checkout API", "Billing Ledger", "Search Index", "Events Pipeline", "Risk Scoring", "Identity Graph", "Reporting Warehouse"]
const products = ["Usage Platform", "Workflow Suite", "Analytics Add-on", "Compliance Pack", "Automation Runtime", "Support Desk"]

function dateFor(index: number): string {
  const month = 1 + (index % 12)
  const day = 4 + (index % 21)
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function createRevenueRow(index: number): RevenueRow {
  const account = accounts[index % accounts.length] ?? "Account"
  const stage = stages[index % stages.length] ?? "Renewal"
  const risk = risks[(index + Math.floor(index / 7)) % risks.length] ?? "Low"
  return {
    rowId: `account-${index + 1}`,
    account: `${account} ${index >= accounts.length ? Math.floor(index / accounts.length) + 1 : ""}`.trim(),
    segment: index % 3 === 0 ? "Enterprise" : index % 3 === 1 ? "Mid-market" : "Strategic",
    owner: owners[index % owners.length] ?? "Owner",
    region: regions[index % regions.length] ?? "NA",
    stage,
    risk,
    arr: 85000 + ((index * 13750) % 940000),
    margin: 48 + ((index * 7) % 34),
    renewal: dateFor(index),
    nextStep: nextSteps[index % nextSteps.length] ?? "Review plan",
  }
}

export function createCapacityRow(index: number): CapacityRow {
  const service = services[index % services.length] ?? "Service"
  const region = regions[index % regions.length] ?? "NA"
  const errors = (index * 13) % 380
  const latencyP95 = 42 + ((index * 17) % 640)
  return {
    rowId: `metric-${index + 1}`,
    service,
    region,
    shard: `${region.toLowerCase()}-${String(index % 64).padStart(2, "0")}`,
    requests: 24000 + ((index * 7919) % 920000),
    errors,
    latencyP95,
    cpu: 18 + ((index * 11) % 78),
    memory: 34 + ((index * 7) % 61),
    cost: 120 + ((index * 31) % 8800),
    owner: owners[index % owners.length] ?? "Owner",
    status: errors > 260 || latencyP95 > 520 ? "Investigate" : latencyP95 > 360 ? "Watch" : "Healthy",
  }
}

export const scaleRows: CapacityRow[] = Array.from({ length: 100_000 }, (_unused, index) => createCapacityRow(index))
export const revenueRows: RevenueRow[] = Array.from({ length: 1_200 }, (_unused, index) => createRevenueRow(index))
export const forecastRows: ForecastRow[] = Array.from({ length: 180 }, (_unused, index) => ({
  rowId: `forecast-${index + 1}`,
  product: products[index % products.length] ?? "Product",
  owner: owners[index % owners.length] ?? "Owner",
  units: 20 + ((index * 9) % 480),
  price: 120 + ((index * 37) % 1280),
  discount: (index % 6) * 250,
  taxRate: 0.07,
  cost: 1600 + ((index * 113) % 36000),
}))

export const scaleColumns: DataGridAppColumnInput[] = [
  { key: "service", label: "Service", initialState: { width: 190, pin: "left" } },
  { key: "region", label: "Region", initialState: { width: 100 } },
  { key: "shard", label: "Shard", initialState: { width: 120 } },
  { key: "requests", label: "Requests", dataType: "number", initialState: { width: 130 } },
  { key: "errors", label: "Errors", dataType: "number", initialState: { width: 110 } },
  { key: "latencyP95", label: "P95 latency", dataType: "number", initialState: { width: 130 } },
  { key: "cpu", label: "CPU %", dataType: "number", initialState: { width: 100 } },
  { key: "memory", label: "Memory %", dataType: "number", initialState: { width: 120 } },
  { key: "cost", label: "Hourly cost", dataType: "currency", initialState: { width: 130 } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "status", label: "Status", initialState: { width: 130 } },
]

export const revenueColumns: DataGridAppColumnInput[] = [
  { key: "account", label: "Account", initialState: { width: 220, pin: "left" } },
  { key: "segment", label: "Segment", initialState: { width: 140 } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "region", label: "Region", initialState: { width: 110 } },
  { key: "stage", label: "Stage", initialState: { width: 180 } },
  { key: "risk", label: "Risk", initialState: { width: 110 } },
  { key: "arr", label: "ARR", dataType: "currency", initialState: { width: 130 } },
  { key: "margin", label: "Margin %", dataType: "number", initialState: { width: 120 } },
  { key: "renewal", label: "Renewal", dataType: "date", initialState: { width: 130 } },
  { key: "nextStep", label: "Next step", initialState: { width: 260 } },
]

export const forecastColumns: DataGridAppColumnInput[] = [
  { key: "product", label: "Product", initialState: { width: 190, pin: "left" } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "units", label: "Units", dataType: "number", capabilities: { editable: true }, initialState: { width: 110 } },
  { key: "price", label: "Price", dataType: "currency", capabilities: { editable: true }, initialState: { width: 120 } },
  { key: "discount", label: "Discount", dataType: "currency", capabilities: { editable: true }, initialState: { width: 120 } },
  { key: "taxRate", label: "Tax rate", dataType: "percent", capabilities: { editable: true }, initialState: { width: 110 } },
  { key: "cost", label: "Cost", dataType: "currency", capabilities: { editable: true }, initialState: { width: 120 } },
  { key: "subtotal", label: "Subtotal", dataType: "currency", formula: "units * price", initialState: { width: 130 } },
  { key: "tax", label: "Tax", dataType: "currency", formula: "subtotal * taxRate", initialState: { width: 120 } },
  { key: "total", label: "Total", dataType: "currency", formula: "subtotal + tax - discount", initialState: { width: 130 } },
  { key: "margin", label: "Margin", dataType: "currency", formula: "total - cost", initialState: { width: 130 } },
  { key: "marginPct", label: "Margin %", dataType: "percent", formula: "(total - cost) / total", initialState: { width: 120 } },
]

export function createBackendDataSource(totalRows = 250_000): DataGridDataSource<CapacityRow> {
  return {
    async pull(request) {
      await new Promise(resolve => window.setTimeout(resolve, 18))
      const start = Math.max(0, request.range.start)
      const end = Math.min(totalRows - 1, request.range.end)
      const rows = []
      for (let index = start; index <= end; index += 1) {
        rows.push({
          index,
          row: createCapacityRow(index),
          rowId: `metric-${index + 1}`,
        })
      }
      return {
        total: totalRows,
        rows,
        datasetVersion: "ops-live-2026-05-24",
      }
    },
    async getColumnHistogram(request) {
      return request.columnId === "status"
        ? [
            { token: "Healthy", value: "Healthy", text: "Healthy", count: 161000 },
            { token: "Watch", value: "Watch", text: "Watch", count: 57000 },
            { token: "Investigate", value: "Investigate", text: "Investigate", count: 32000 },
          ]
        : [
            { token: "NA", value: "NA", text: "NA", count: 73000 },
            { token: "EMEA", value: "EMEA", text: "EMEA", count: 64000 },
            { token: "APAC", value: "APAC", text: "APAC", count: 61000 },
            { token: "LATAM", value: "LATAM", text: "LATAM", count: 52000 },
          ]
    },
  }
}
