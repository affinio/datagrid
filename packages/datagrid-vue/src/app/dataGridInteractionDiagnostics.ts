import type { DataGridAppInteractionOwnerSnapshot } from "./dataGridInteractionOwner"

const DATA_GRID_PERF_TRACE_QUERY_PARAM = "dgPerfTrace"
const DATA_GRID_PERF_TRACE_STORAGE_KEY = "affino-datagrid-perf-trace"
const DATA_GRID_PERF_STORE_KEY = "__AFFINO_DATAGRID_PERF__"
const DATA_GRID_PERF_SAMPLE_LIMIT = 400

type DataGridInteractionDiagnosticField = string | number

interface DataGridInteractionDiagnosticSample {
  scope: string
  ts: number
  totalMs: number
  [key: string]: DataGridInteractionDiagnosticField
}

interface DataGridInteractionDiagnosticSampleInput {
  scope: string
  totalMs: number
  ts?: number
  [key: string]: DataGridInteractionDiagnosticField | undefined
}

interface DataGridInteractionDiagnosticStore {
  samples: DataGridInteractionDiagnosticSample[]
  push: (sample: DataGridInteractionDiagnosticSample) => void
  clear?: () => void
  latest?: (scope?: string) => DataGridInteractionDiagnosticSample | null
  summary?: () => Array<{ scope: string; count: number; meanMs: number; p95Ms: number; maxMs: number }>
}

export type DataGridInteractionCancelReason =
  | "blur"
  | "contextmenu"
  | "dispose"
  | "escape"
  | "pointercancel"

export type DataGridInteractionPreviewOwner = "drag-selection" | "fill" | "range-move"

function parseDataGridBooleanToken(value: string | null): boolean | null {
  if (!value) {
    return null
  }
  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "on") {
    return true
  }
  if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "off") {
    return false
  }
  return null
}

export function resolveDataGridInteractionDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  const queryFlag = parseDataGridBooleanToken(
    new URLSearchParams(window.location.search).get(DATA_GRID_PERF_TRACE_QUERY_PARAM),
  )
  if (queryFlag != null) {
    return queryFlag
  }
  try {
    const storedFlag = parseDataGridBooleanToken(
      window.localStorage?.getItem(DATA_GRID_PERF_TRACE_STORAGE_KEY) ?? null,
    )
    return storedFlag ?? false
  }
  catch {
    return false
  }
}

export function resolveDataGridInteractionDiagnosticsNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function createDataGridInteractionDiagnosticStore(): DataGridInteractionDiagnosticStore {
  const samples: DataGridInteractionDiagnosticSample[] = []
  return {
    samples,
    push(sample) {
      samples.push(sample)
      if (samples.length > DATA_GRID_PERF_SAMPLE_LIMIT) {
        samples.splice(0, samples.length - DATA_GRID_PERF_SAMPLE_LIMIT)
      }
    },
    clear() {
      samples.length = 0
    },
    latest(scope) {
      if (!scope) {
        return samples.length > 0 ? (samples[samples.length - 1] ?? null) : null
      }
      for (let index = samples.length - 1; index >= 0; index -= 1) {
        if (samples[index]?.scope === scope) {
          return samples[index] ?? null
        }
      }
      return null
    },
    summary() {
      const grouped = new Map<string, number[]>()
      for (const sample of samples) {
        const bucket = grouped.get(sample.scope) ?? []
        bucket.push(sample.totalMs)
        grouped.set(sample.scope, bucket)
      }
      return Array.from(grouped.entries()).map(([scope, values]) => {
        const sortedValues = [...values].sort((left, right) => left - right)
        const total = sortedValues.reduce((sum, value) => sum + value, 0)
        const p95Index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * 0.95) - 1))
        return {
          scope,
          count: sortedValues.length,
          meanMs: total / Math.max(1, sortedValues.length),
          p95Ms: sortedValues[p95Index] ?? 0,
          maxMs: sortedValues.length > 0 ? (sortedValues[sortedValues.length - 1] ?? 0) : 0,
        }
      })
    },
  }
}

function resolveDataGridInteractionDiagnosticStore(): DataGridInteractionDiagnosticStore | null {
  if (typeof window === "undefined") {
    return null
  }
  const perfWindow = window as typeof window & { [DATA_GRID_PERF_STORE_KEY]?: DataGridInteractionDiagnosticStore }
  if (!perfWindow[DATA_GRID_PERF_STORE_KEY]) {
    perfWindow[DATA_GRID_PERF_STORE_KEY] = createDataGridInteractionDiagnosticStore()
  }
  return perfWindow[DATA_GRID_PERF_STORE_KEY] ?? null
}

function recordDataGridInteractionDiagnosticSample(
  sample: DataGridInteractionDiagnosticSampleInput,
): void {
  if (!resolveDataGridInteractionDiagnosticsEnabled()) {
    return
  }
  const { ts, ...fields } = sample
  resolveDataGridInteractionDiagnosticStore()?.push({
    ...fields,
    ts: ts ?? resolveDataGridInteractionDiagnosticsNow(),
  } as DataGridInteractionDiagnosticSample)
}

function serializeOwnerSnapshot(snapshot: DataGridAppInteractionOwnerSnapshot): string {
  return snapshot.activeOwners.length > 0 ? snapshot.activeOwners.join(",") : "none"
}

export function recordDataGridInteractionOwnerTransition(
  previous: DataGridAppInteractionOwnerSnapshot | null | undefined,
  next: DataGridAppInteractionOwnerSnapshot,
): void {
  recordDataGridInteractionDiagnosticSample({
    scope: "interactionOwner",
    totalMs: 0,
    previousOwner: previous?.owner ?? "none",
    owner: next.owner ?? "none",
    activeOwners: serializeOwnerSnapshot(next),
    conflict: next.hasConflict ? 1 : 0,
  })
}

export function recordDataGridInteractionCancel(
  reason: DataGridInteractionCancelReason,
  commit: boolean,
  snapshot: DataGridAppInteractionOwnerSnapshot,
): void {
  recordDataGridInteractionDiagnosticSample({
    scope: "interactionCancel",
    totalMs: 0,
    reason,
    commit: commit ? 1 : 0,
    owner: snapshot.owner ?? "none",
    activeOwners: serializeOwnerSnapshot(snapshot),
    conflict: snapshot.hasConflict ? 1 : 0,
  })
}

export function recordDataGridInteractionPreviewTiming(
  owner: DataGridInteractionPreviewOwner,
  totalMs: number,
): void {
  recordDataGridInteractionDiagnosticSample({
    scope: "interactionPreview",
    totalMs,
    owner,
  })
}

export function recordDataGridInteractionAutoScrollTiming(payload: {
  owner: DataGridInteractionPreviewOwner | "none"
  totalMs: number
  deltaX: number
  deltaY: number
  scrolled: boolean
}): void {
  recordDataGridInteractionDiagnosticSample({
    scope: "interactionAutoScroll",
    totalMs: payload.totalMs,
    owner: payload.owner,
    deltaX: payload.deltaX,
    deltaY: payload.deltaY,
    scrolled: payload.scrolled ? 1 : 0,
  })
}

export function recordDataGridInteractionPreventDefault(payload: {
  owner: string
  eventType: string
  reason: string
}): void {
  recordDataGridInteractionDiagnosticSample({
    scope: "interactionPreventDefault",
    totalMs: 0,
    owner: payload.owner,
    eventType: payload.eventType,
    reason: payload.reason,
  })
}
