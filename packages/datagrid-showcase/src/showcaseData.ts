import { h } from "vue"
import type { DataGridAppColumnInput } from "@affino/datagrid-vue-app"
import type { DataGridDataSource } from "@affino/datagrid-vue"

export type ScenarioId = "scale" | "backend" | "spreadsheet" | "filters" | "aggregation" | "pivot" | "tree" | "gantt"

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
  environment: string
  tier: string
  version: string
  deployState: string
  incidents: number
  saturation: number
  throughput: number
  queueDepth: number
  availability: number
  errorBudget: number
  lastDeploy: string
  zone: string
  plan: string
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

export type PortfolioTreeRow = RevenueRow & {
  path: string[]
  portfolioType: string
}

export type PlanningRow = {
  rowId: string
  id: string
  name: string
  owner: string
  start: string
  end: string
  baselineStart: string
  baselineEnd: string
  progress: number
  dependencies: string[]
  critical: boolean
  workstream: string
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
const environments = ["Production", "Staging", "Canary"]
const tiers = ["Critical", "Standard", "Batch", "Analytics"]
const deployStates = ["Current", "Rolling", "Pinned", "Blocked"]
const plans = ["Autoscale", "Observe", "Rebalance", "Patch", "Capacity review"]
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
    environment: environments[index % environments.length] ?? "Production",
    tier: tiers[index % tiers.length] ?? "Standard",
    version: `v${2 + (index % 4)}.${index % 12}.${index % 18}`,
    deployState: deployStates[(index + 1) % deployStates.length] ?? "Current",
    incidents: (index * 3) % 9,
    saturation: 22 + ((index * 19) % 73),
    throughput: 900 + ((index * 233) % 18000),
    queueDepth: (index * 29) % 4800,
    availability: 99 + (((index * 17) % 95) / 100),
    errorBudget: 4 + ((index * 5) % 92),
    lastDeploy: dateFor(index + 17),
    zone: `${region.toLowerCase()}-${1 + (index % 4)}`,
    plan: plans[index % plans.length] ?? "Observe",
  }
}

function badge(value: unknown, tone: "success" | "warning" | "danger" | "info" | "neutral") {
  return h("span", { class: ["showcase-cell-badge", `showcase-cell-badge--${tone}`] }, String(value ?? ""))
}

function statusTone(status: unknown): "success" | "warning" | "danger" {
  if (status === "Investigate") {
    return "danger"
  }
  if (status === "Watch") {
    return "warning"
  }
  return "success"
}

function deployTone(state: unknown): "success" | "warning" | "danger" | "neutral" {
  if (state === "Blocked") {
    return "danger"
  }
  if (state === "Rolling") {
    return "warning"
  }
  if (state === "Current") {
    return "success"
  }
  return "neutral"
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

export const treeRows: PortfolioTreeRow[] = revenueRows.slice(0, 360).map((row, index) => ({
  ...row,
  rowId: `portfolio-${index + 1}`,
  path: [row.region, row.segment, row.owner, row.account],
  portfolioType: index % 2 === 0 ? "Retain" : "Expand",
}))

export const planningRows: PlanningRow[] = Array.from({ length: 72 }, (_unused, index) => {
  const startDay = 1 + (index % 22)
  const duration = 4 + (index % 14)
  const id = `task-${index + 1}`
  return {
    rowId: id,
    id,
    name: `${products[index % products.length] ?? "Program"} milestone ${index + 1}`,
    owner: owners[index % owners.length] ?? "Owner",
    start: `2026-06-${String(startDay).padStart(2, "0")}`,
    end: `2026-06-${String(Math.min(28, startDay + duration)).padStart(2, "0")}`,
    baselineStart: `2026-06-${String(Math.max(1, startDay - 1)).padStart(2, "0")}`,
    baselineEnd: `2026-06-${String(Math.min(28, startDay + duration + 2)).padStart(2, "0")}`,
    progress: (index * 17) % 100,
    dependencies: index > 0 && index % 4 !== 0 ? [`task-${index}`] : [],
    critical: index % 9 === 0 || index % 13 === 0,
    workstream: ["Platform", "Revenue", "Data", "Operations"][index % 4] ?? "Platform",
  }
})

export const scaleColumns: DataGridAppColumnInput[] = [
  { key: "service", label: "Service", initialState: { width: 190, pin: "left" } },
  { key: "status", label: "Status", initialState: { width: 140 }, cellRenderer: ({ displayValue }) => badge(displayValue, statusTone(displayValue)) },
  { key: "environment", label: "Environment", initialState: { width: 140 }, cellRenderer: ({ displayValue }) => badge(displayValue, displayValue === "Production" ? "info" : "neutral") },
  { key: "tier", label: "Tier", initialState: { width: 120 }, cellRenderer: ({ displayValue }) => badge(displayValue, displayValue === "Critical" ? "danger" : "neutral") },
  { key: "region", label: "Region", initialState: { width: 100 } },
  { key: "zone", label: "Zone", initialState: { width: 100 } },
  { key: "shard", label: "Shard", initialState: { width: 120 } },
  { key: "version", label: "Version", initialState: { width: 110 } },
  { key: "deployState", label: "Deploy", initialState: { width: 120 }, cellRenderer: ({ displayValue }) => badge(displayValue, deployTone(displayValue)) },
  { key: "requests", label: "Requests", dataType: "number", initialState: { width: 130 } },
  { key: "throughput", label: "Throughput/s", dataType: "number", initialState: { width: 140 } },
  { key: "errors", label: "Errors", dataType: "number", initialState: { width: 110 } },
  { key: "incidents", label: "Incidents", dataType: "number", initialState: { width: 110 } },
  { key: "latencyP95", label: "P95 latency", dataType: "number", initialState: { width: 130 } },
  { key: "queueDepth", label: "Queue depth", dataType: "number", initialState: { width: 130 } },
  { key: "cpu", label: "CPU %", dataType: "number", initialState: { width: 100 } },
  { key: "memory", label: "Memory %", dataType: "number", initialState: { width: 120 } },
  { key: "saturation", label: "Saturation %", dataType: "number", initialState: { width: 130 } },
  { key: "availability", label: "Availability", dataType: "number", initialState: { width: 130 } },
  { key: "errorBudget", label: "Error budget %", dataType: "number", initialState: { width: 140 } },
  { key: "cost", label: "Hourly cost", dataType: "currency", initialState: { width: 130 } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "lastDeploy", label: "Last deploy", dataType: "date", initialState: { width: 130 } },
  { key: "plan", label: "Plan", initialState: { width: 150 }, cellRenderer: ({ displayValue }) => badge(displayValue, "info") },
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

export const treeColumns: DataGridAppColumnInput[] = [
  { key: "account", label: "Account", initialState: { width: 230, pin: "left" } },
  { key: "region", label: "Region", initialState: { width: 110 } },
  { key: "segment", label: "Segment", initialState: { width: 140 } },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "portfolioType", label: "Type", initialState: { width: 120 }, cellRenderer: ({ displayValue }) => badge(displayValue, displayValue === "Expand" ? "info" : "neutral") },
  { key: "arr", label: "ARR", dataType: "currency", initialState: { width: 130 } },
  { key: "risk", label: "Risk", initialState: { width: 110 }, cellRenderer: ({ displayValue }) => badge(displayValue, displayValue === "High" ? "danger" : displayValue === "Medium" ? "warning" : "success") },
  { key: "nextStep", label: "Next step", initialState: { width: 260 } },
]

export const planningColumns: DataGridAppColumnInput[] = [
  { key: "name", label: "Task", initialState: { width: 260, pin: "left" } },
  { key: "workstream", label: "Workstream", initialState: { width: 130 }, cellRenderer: ({ displayValue }) => badge(displayValue, "info") },
  { key: "owner", label: "Owner", initialState: { width: 130 } },
  { key: "start", label: "Start", dataType: "date", initialState: { width: 120 } },
  { key: "end", label: "End", dataType: "date", initialState: { width: 120 } },
  { key: "progress", label: "Progress", dataType: "number", initialState: { width: 110 } },
  { key: "critical", label: "Critical", initialState: { width: 110 }, cellRenderer: ({ displayValue }) => badge(displayValue ? "Critical" : "Normal", displayValue ? "danger" : "neutral") },
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
