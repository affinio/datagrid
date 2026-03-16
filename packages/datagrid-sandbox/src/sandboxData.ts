import type { DataGridColumnInput, DataGridRowNodeInput } from "@affino/datagrid-core"

export interface VueBaseRow {
  rowId: string
  id: number
  name: string
  amount: number
  start: string | Date
  end: string | Date
  updatedAt: string
  stage: string
  status: string
  region: string
  category: string
  qty: number
  baselineStart: string | Date
  baselineEnd: string | Date
  progress: number
  dependencies: string | string[]
  critical: boolean
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
const STAGES = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
] as const
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

function formatSandboxUtcDate(dayOffset: number): string {
  return new Date(Date.UTC(2026, 2, 1 + dayOffset)).toISOString()
}

function appendExtraColumns(base: DataGridColumnInput[], columnCount: number): DataGridColumnInput[] {
  const columns = [...base]
  const extraCount = Math.max(0, columnCount - columns.length)
  for (let index = 0; index < extraCount; index += 1) {
    const key = `extra_${index + 1}`
    columns.push({
      key,
      label: `Extra ${index + 1}`,
      initialState: { width: 120 + ((index % 3) * 12) },
      dataType: index % 2 === 0 ? "text" : "number",
      presentation: index % 2 === 0 ? undefined : { align: "right", headerAlign: "right" },
      capabilities: { sortable: true, filterable: true },
    })
  }
  return columns
}

function fillExtraFields(row: Record<string, unknown>, rowIndex: number, columnCount: number, baseColumnsLength: number): void {
  const extraCount = Math.max(0, columnCount - baseColumnsLength)
  for (let extraIndex = 0; extraIndex < extraCount; extraIndex += 1) {
    row[`extra_${extraIndex + 1}`] = `v-${extraIndex + 1}-${rowIndex % 97}`
  }
}

export function buildVueColumns(mode: "base" | "tree" | "pivot" | "worker", columnCount: number): DataGridColumnInput[] {
  const baseColumns: DataGridColumnInput[] = mode === "tree"
    ? [
        { key: "id", label: "ID", dataType: "number", initialState: { width: 92, pin: "left" }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true } },
        { key: "name", label: "Node", initialState: { width: 220, pin: "left" }, capabilities: { sortable: true, filterable: true } },
        { key: "parentTeam", label: "Team", initialState: { width: 150 }, capabilities: { sortable: true, filterable: true, groupable: true } },
        { key: "squad", label: "Squad", initialState: { width: 150 }, capabilities: { sortable: true, filterable: true, groupable: true } },
        { key: "assignee", label: "Assignee", initialState: { width: 150 }, capabilities: { sortable: true, filterable: true } },
        { key: "severity", label: "Severity", initialState: { width: 110 }, capabilities: { sortable: true, filterable: true } },
        { key: "status", label: "Status", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
        { key: "amount", label: "Cost", dataType: "currency", initialState: { width: 132 }, presentation: { align: "right", headerAlign: "right", format: { number: { locale: "en-GB", style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 } } }, capabilities: { sortable: true, filterable: true, aggregatable: true }, constraints: { min: 0 } },
      ]
    : mode === "pivot"
      ? [
          { key: "id", label: "ID", dataType: "number", initialState: { width: 92, pin: "left" }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true } },
          { key: "name", label: "Deal", initialState: { width: 220 }, capabilities: { sortable: true, filterable: true } },
          { key: "department", label: "Department", initialState: { width: 140 }, capabilities: { sortable: true, filterable: true, groupable: true } },
          { key: "month", label: "Month", dataType: "date", initialState: { width: 120 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short" } } }, capabilities: { sortable: true, filterable: true, groupable: true } },
          { key: "channel", label: "Channel", initialState: { width: 130 }, capabilities: { sortable: true, filterable: true, groupable: true } },
          { key: "status", label: "Status", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
          { key: "amount", label: "Revenue", dataType: "currency", initialState: { width: 140 }, presentation: { align: "right", headerAlign: "right", format: { number: { locale: "en-GB", style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 } } }, capabilities: { sortable: true, filterable: true, aggregatable: true }, constraints: { min: 0 } },
          { key: "deals", label: "Deals", dataType: "number", initialState: { width: 110 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true, aggregatable: true }, constraints: { min: 0 } },
        ]
      : mode === "worker"
        ? [
            { key: "id", label: "ID", dataType: "number", initialState: { width: 92, pin: "left" }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true } },
            { key: "name", label: "Task", initialState: { width: 220 }, capabilities: { sortable: true, filterable: true } },
            { key: "queue", label: "Queue", initialState: { width: 130 }, capabilities: { sortable: true, filterable: true } },
            { key: "shard", label: "Shard", initialState: { width: 130 }, capabilities: { sortable: true, filterable: true } },
            { key: "latencyMs", label: "Latency ms", dataType: "number", initialState: { width: 130 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true }, constraints: { min: 0 } },
            { key: "retries", label: "Retries", dataType: "number", initialState: { width: 100 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true }, constraints: { min: 0 } },
            { key: "status", label: "Status", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
            { key: "amount", label: "Weight", dataType: "number", initialState: { width: 110 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true, aggregatable: true }, constraints: { min: 0 } },
          ]
        : [
            { key: "id", label: "ID", dataType: "number", initialState: { width: 92, pin: "left" }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true } },
            { key: "name", label: "Task", initialState: { width: 220 }, capabilities: { sortable: true, filterable: true } },
            { key: "amount", label: "Amount", dataType: "currency", initialState: { width: 140 }, presentation: { align: "right", headerAlign: "right", format: { number: { locale: "en-GB", style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 } } }, capabilities: { sortable: true, filterable: true, editable: true, aggregatable: true }, constraints: { min: 0, max: 100_000 } },
            { key: "start", label: "Start", dataType: "date", initialState: { width: 140 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit" } } }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "end", label: "End", dataType: "date", initialState: { width: 140 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit" } } }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "updatedAt", label: "Updated", dataType: "datetime", initialState: { width: 168 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" } } }, capabilities: { sortable: true, filterable: true } },
          { key: "stage", label: "Stage", cellType: "select", initialState: { width: 132 }, presentation: { options: STAGES }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "region", label: "Region", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true, groupable: true } },
            { key: "category", label: "Category", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true, groupable: true } },
            { key: "status", label: "Status", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
            { key: "baselineStart", label: "Baseline Start", dataType: "date", initialState: { width: 152 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit" } } }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "baselineEnd", label: "Baseline End", dataType: "date", initialState: { width: 152 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit" } } }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "progress", label: "% Complete", dataType: "number", initialState: { width: 120 }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true, editable: true }, constraints: { min: 0, max: 100 } },
            { key: "dependencies", label: "Predecessors", initialState: { width: 150 }, capabilities: { sortable: true, filterable: true, editable: true } },
            { key: "critical", label: "Critical", dataType: "boolean", initialState: { width: 108 }, capabilities: { sortable: true, filterable: true, editable: true } },
          ]

  return appendExtraColumns(baseColumns, columnCount)
}

export function buildCoreColumns(columnCount: number): DataGridColumnInput[] {
  return appendExtraColumns([
    { key: "id", label: "ID", dataType: "number", initialState: { width: 92, pin: "left" }, presentation: { align: "right", headerAlign: "right" }, capabilities: { sortable: true, filterable: true } },
    { key: "name", label: "Event", initialState: { width: 220 }, capabilities: { sortable: true, filterable: true } },
    { key: "source", label: "Source", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true, groupable: true } },
    { key: "owner", label: "Owner", initialState: { width: 140 }, capabilities: { sortable: true, filterable: true, groupable: true } },
    { key: "status", label: "Status", initialState: { width: 120 }, capabilities: { sortable: true, filterable: true } },
    { key: "amount", label: "Score", dataType: "number", initialState: { width: 120 }, presentation: { align: "right", headerAlign: "right", format: { number: { locale: "en-GB", style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 2 } } }, capabilities: { sortable: true, filterable: true, aggregatable: true }, constraints: { min: 0 } },
    { key: "updatedAt", label: "Updated", dataType: "date", initialState: { width: 140 }, presentation: { format: { dateTime: { locale: "en-GB", year: "numeric", month: "short", day: "2-digit" } } }, capabilities: { sortable: true, filterable: true } },
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

export function buildWorkerRowInputs(
  rowCount: number,
  columnCount: number,
): DataGridRowNodeInput<VueWorkerRow>[] {
  const rows: DataGridRowNodeInput<VueWorkerRow>[] = new Array(rowCount)
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
    rows[index] = {
      row,
      rowId: row.rowId,
      originalIndex: index,
    }
  }

  return rows
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
  const baseColumnsLength = 15

  for (let index = 0; index < rowCount; index += 1) {
    const region = REGIONS[index % REGIONS.length] ?? "Unknown"
    const category = CATEGORIES[index % CATEGORIES.length] ?? "X"
    const stage = STAGES[index % STAGES.length]?.value ?? "backlog"
    const status = STATUSES[index % STATUSES.length] ?? "new"
    const startOffsetDays = (index * 3) % 120
    const durationDays = 2 + (index % 12)
    const dependencies: string[] = []
    const previousRegionTaskId = index + 1 - REGIONS.length
    if (previousRegionTaskId >= 1) {
      dependencies.push(
        index % 7 === 0
          ? `${previousRegionTaskId}:SS`
          : index % 5 === 0
            ? `${previousRegionTaskId}FF`
            : String(previousRegionTaskId),
      )
    }
    if (index > 2 && index % 11 === 0) {
      dependencies.push(index % 2 === 0 ? `${index - 2}FF` : String(index - 2))
    }
    if (index > 5 && index % 17 === 0) {
      dependencies.push(`${index - 5}->SF`)
    }
    const baselineLeadDays = (index % 4) + 1
    const baselineLagDays = index % 3
    const dependencyValue = dependencies.join(",")
    const row: VueBaseRow = {
      rowId: `base-${index + 1}`,
      id: index + 1,
      name: `Task ${index + 1}`,
      amount: (index % 500) * 3 + (index % 17),
      start: formatSandboxUtcDate(startOffsetDays),
      end: formatSandboxUtcDate(startOffsetDays + durationDays),
      updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}T${String((index * 3) % 24).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:00.000Z`,
      stage,
      status,
      region,
      category,
      qty: (index % 20) + 1,
      baselineStart: formatSandboxUtcDate(startOffsetDays - baselineLeadDays),
      baselineEnd: formatSandboxUtcDate(startOffsetDays + durationDays - baselineLagDays),
      progress: (index * 13) % 101,
      dependencies: dependencyValue,
      critical: durationDays >= 10 || index % 9 === 0,
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
  return buildWorkerRowInputs(rowCount, columnCount).map(entry => entry.row as VueWorkerRow)
}

export function toRowInputs<TRow>(rows: readonly TRow[]): DataGridRowNodeInput<TRow>[] {
  return rows.map((row, index) => ({
    row,
    rowId: String((row as { rowId?: string }).rowId ?? `${index}`),
    originalIndex: index,
  }))
}
