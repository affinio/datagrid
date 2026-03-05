import type { DataGridColumnDef, DataGridRowNodeInput } from "@affino/datagrid-core"

export interface VueBaseRow {
  rowId: string
  id: number
  name: string
  status: string
  amount: number
  region: string
  category: string
  qty: number
  updatedAt: string
  [key: string]: unknown
}

export interface VueTreeRow {
  rowId: string
  id: number
  name: string
  status: string
  amount: number
  path: string[]
  parentTeam: string
  squad: string
  assignee: string
  severity: string
  updatedAt: string
  [key: string]: unknown
}

export interface VuePivotRow {
  rowId: string
  id: number
  name: string
  status: string
  amount: number
  department: string
  month: string
  channel: string
  deals: number
  marginPct: number
  updatedAt: string
  [key: string]: unknown
}

export interface VueWorkerRow {
  rowId: string
  id: number
  name: string
  status: string
  amount: number
  queue: string
  shard: string
  latencyMs: number
  retries: number
  updatedAt: string
  [key: string]: unknown
}

export interface CoreBaseRow {
  rowId: string
  id: number
  name: string
  status: string
  amount: number
  source: string
  owner: string
  updatedAt: string
  [key: string]: unknown
}

export type VueSandboxRow = VueBaseRow | VueTreeRow | VuePivotRow | VueWorkerRow

const REGIONS = ["North", "South", "East", "West"]
const CATEGORIES = ["A", "B", "C", "D", "E"]
const STATUSES = ["new", "active", "hold", "done"]
const TEAMS = ["Platform", "Data", "Search", "Ops"]
const SQUADS = ["Ingest", "Runtime", "Analytics", "Billing", "Integrations"]
const ASSIGNEES = ["Alice", "Bob", "Carla", "Dmitri", "Eva", "Farid"]
const SEVERITIES = ["S1", "S2", "S3", "S4"]
const DEPARTMENTS = ["Sales", "Support", "Finance", "Product"]
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const CHANNELS = ["Web", "Email", "Partner", "Direct"]
const QUEUES = ["sync", "refresh", "export", "alerts"]
const SHARDS = ["shard-a", "shard-b", "shard-c"]
const SOURCES = ["api", "batch", "manual", "import"]
const OWNERS = ["team-red", "team-blue", "team-green"]

export const ROW_MODE_OPTIONS = [1000, 10000, 50000, 100000, 200000] as const
export const COLUMN_MODE_OPTIONS = [8, 16, 32] as const

function appendExtraColumns(base: DataGridColumnDef[], columnCount: number): DataGridColumnDef[] {
  const columns = [...base]
  const extraCount = Math.max(0, columnCount - columns.length)
  for (let index = 0; index < extraCount; index += 1) {
    const key = `extra_${index + 1}`
    columns.push({ key, label: `Extra ${index + 1}` })
  }
  return columns
}

function fillExtraFields(row: Record<string, unknown>, rowIndex: number, columnCount: number, baseColumnsLength: number): void {
  const extraCount = Math.max(0, columnCount - baseColumnsLength)
  for (let extraIndex = 0; extraIndex < extraCount; extraIndex += 1) {
    row[`extra_${extraIndex + 1}`] = `v-${extraIndex + 1}-${rowIndex % 97}`
  }
}

export function buildVueColumns(mode: "base" | "tree" | "pivot" | "worker", columnCount: number): DataGridColumnDef[] {
  const baseColumns: DataGridColumnDef[] = mode === "tree"
    ? [
        { key: "id", label: "ID" },
        { key: "name", label: "Node" },
        { key: "parentTeam", label: "Team" },
        { key: "squad", label: "Squad" },
        { key: "assignee", label: "Assignee" },
        { key: "severity", label: "Severity" },
        { key: "status", label: "Status" },
        { key: "amount", label: "Cost" },
      ]
    : mode === "pivot"
      ? [
          { key: "id", label: "ID" },
          { key: "name", label: "Deal" },
          { key: "department", label: "Department" },
          { key: "month", label: "Month" },
          { key: "channel", label: "Channel" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Revenue" },
          { key: "deals", label: "Deals" },
        ]
      : mode === "worker"
        ? [
            { key: "id", label: "ID" },
            { key: "name", label: "Task" },
            { key: "queue", label: "Queue" },
            { key: "shard", label: "Shard" },
            { key: "latencyMs", label: "Latency ms" },
            { key: "retries", label: "Retries" },
            { key: "status", label: "Status" },
            { key: "amount", label: "Weight" },
          ]
        : [
            { key: "id", label: "ID" },
            { key: "name", label: "Item" },
            { key: "region", label: "Region" },
            { key: "category", label: "Category" },
            { key: "status", label: "Status" },
            { key: "amount", label: "Amount" },
            { key: "qty", label: "Qty" },
            { key: "updatedAt", label: "Updated" },
          ]

  return appendExtraColumns(baseColumns, columnCount)
}

export function buildCoreColumns(columnCount: number): DataGridColumnDef[] {
  return appendExtraColumns([
    { key: "id", label: "ID" },
    { key: "name", label: "Event" },
    { key: "source", label: "Source" },
    { key: "owner", label: "Owner" },
    { key: "status", label: "Status" },
    { key: "amount", label: "Score" },
    { key: "updatedAt", label: "Updated" },
  ], columnCount)
}

export function buildVueRows(mode: "base" | "tree" | "pivot" | "worker", rowCount: number, columnCount: number): VueSandboxRow[] {
  if (mode === "tree") {
    return buildTreeRows(rowCount, columnCount)
  }
  if (mode === "pivot") {
    return buildPivotRows(rowCount, columnCount)
  }
  if (mode === "worker") {
    return buildWorkerRows(rowCount, columnCount)
  }
  return buildBaseRows(rowCount, columnCount)
}

export function buildCoreRows(rowCount: number, columnCount: number): CoreBaseRow[] {
  const rows: CoreBaseRow[] = new Array(rowCount)
  const baseColumnsLength = 7

  for (let index = 0; index < rowCount; index += 1) {
    const row: CoreBaseRow = {
      rowId: `core-${index + 1}`,
      id: index + 1,
      name: `CoreEvent ${index + 1}`,
      source: SOURCES[index % SOURCES.length] ?? "api",
      owner: OWNERS[index % OWNERS.length] ?? "team-red",
      status: STATUSES[index % STATUSES.length] ?? "new",
      amount: (index % 1000) + ((index % 7) * 3),
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
    }
    fillExtraFields(row, index, columnCount, baseColumnsLength)
    rows[index] = row
  }

  return rows
}

function buildBaseRows(rowCount: number, columnCount: number): VueBaseRow[] {
  const rows: VueBaseRow[] = new Array(rowCount)
  const baseColumnsLength = 8

  for (let index = 0; index < rowCount; index += 1) {
    const region = REGIONS[index % REGIONS.length] ?? "Unknown"
    const category = CATEGORIES[index % CATEGORIES.length] ?? "X"
    const status = STATUSES[index % STATUSES.length] ?? "new"
    const row: VueBaseRow = {
      rowId: `base-${index + 1}`,
      id: index + 1,
      name: `Item ${index + 1}`,
      status,
      amount: (index % 500) * 3 + (index % 17),
      region,
      category,
      qty: (index % 20) + 1,
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
    }
    fillExtraFields(row, index, columnCount, baseColumnsLength)
    rows[index] = row
  }

  return rows
}

function buildTreeRows(rowCount: number, columnCount: number): VueTreeRow[] {
  const rows: VueTreeRow[] = new Array(rowCount)
  const baseColumnsLength = 8

  for (let index = 0; index < rowCount; index += 1) {
    const team = TEAMS[index % TEAMS.length] ?? "Platform"
    const squad = SQUADS[index % SQUADS.length] ?? "Runtime"
    const status = STATUSES[index % STATUSES.length] ?? "new"
    const severity = SEVERITIES[index % SEVERITIES.length] ?? "S3"
    const assignee = ASSIGNEES[index % ASSIGNEES.length] ?? "Alice"
    const row: VueTreeRow = {
      rowId: `tree-${index + 1}`,
      id: index + 1,
      name: `Issue ${index + 1}`,
      status,
      amount: 10 + (index % 120),
      path: [team, squad],
      parentTeam: team,
      squad,
      assignee,
      severity,
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
    }
    fillExtraFields(row, index, columnCount, baseColumnsLength)
    rows[index] = row
  }

  return rows
}

function buildPivotRows(rowCount: number, columnCount: number): VuePivotRow[] {
  const rows: VuePivotRow[] = new Array(rowCount)
  const baseColumnsLength = 8
  const departmentCount = DEPARTMENTS.length || 1
  const monthCount = MONTHS.length || 1
  const channelCount = CHANNELS.length || 1
  const statusCount = STATUSES.length || 1

  const strideDepartment = 1
  const strideMonth = departmentCount
  const strideChannel = departmentCount * monthCount
  const strideStatus = departmentCount * monthCount * channelCount

  for (let index = 0; index < rowCount; index += 1) {
    // Deterministic cartesian cycle for dense pivot coverage without axis correlation.
    const departmentIndex = Math.floor(index / strideDepartment) % departmentCount
    const monthIndex = Math.floor(index / strideMonth) % monthCount
    const channelIndex = Math.floor(index / strideChannel) % channelCount
    const statusIndex = Math.floor(index / strideStatus) % statusCount

    const department = DEPARTMENTS[departmentIndex] ?? "Sales"
    const month = MONTHS[monthIndex] ?? "2026-01"
    const channel = CHANNELS[channelIndex] ?? "Web"
    const status = STATUSES[statusIndex] ?? "new"

    // Stable mixed seed to avoid modulo stripes/checkerboard in aggregated pivot values.
    const seed = (
      ((departmentIndex + 1) * 73856093) ^
      ((monthIndex + 1) * 19349663) ^
      ((channelIndex + 1) * 83492791) ^
      ((statusIndex + 1) * 2654435761) ^
      ((index + 1) * 97531)
    ) >>> 0

    const deals = (seed % 12) + 1
    const amount = deals * (120 + (seed % 85))
    const marginPct = 8 + ((seed >>> 8) % 32)
    const row: VuePivotRow = {
      rowId: `pivot-${index + 1}`,
      id: index + 1,
      name: `Deal ${index + 1}`,
      status,
      amount,
      department,
      month,
      channel,
      deals,
      marginPct,
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
    }
    fillExtraFields(row, index, columnCount, baseColumnsLength)
    rows[index] = row
  }

  return rows
}

function buildWorkerRows(rowCount: number, columnCount: number): VueWorkerRow[] {
  const rows: VueWorkerRow[] = new Array(rowCount)
  const baseColumnsLength = 8

  for (let index = 0; index < rowCount; index += 1) {
    const status = STATUSES[index % STATUSES.length] ?? "new"
    const queue = QUEUES[index % QUEUES.length] ?? "sync"
    const shard = SHARDS[index % SHARDS.length] ?? "shard-a"
    const row: VueWorkerRow = {
      rowId: `worker-${index + 1}`,
      id: index + 1,
      name: `Task ${index + 1}`,
      status,
      amount: (index % 100) + 1,
      queue,
      shard,
      latencyMs: 5 + (index % 300),
      retries: index % 4,
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}`,
    }
    fillExtraFields(row, index, columnCount, baseColumnsLength)
    rows[index] = row
  }

  return rows
}

export function toRowInputs<TRow>(rows: readonly TRow[]): DataGridRowNodeInput<TRow>[] {
  return rows.map((row, index) => ({
    row,
    rowId: String((row as { rowId?: string }).rowId ?? `${index}`),
    originalIndex: index,
  }))
}
