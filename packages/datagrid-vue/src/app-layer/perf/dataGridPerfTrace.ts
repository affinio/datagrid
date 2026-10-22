const DATA_GRID_PERF_TRACE_QUERY_PARAM = "dgPerfTrace"
const DATA_GRID_PERF_TRACE_STORAGE_KEY = "affino-datagrid-perf-trace"
export const DATA_GRID_PERF_STORE_KEY = "__AFFINO_DATAGRID_PERF__"
const DATA_GRID_PERF_SAMPLE_LIMIT = 400

export type DataGridPerfSample = {
  scope: string
  ts: number
  totalMs: number
  [key: string]: string | number
}

export type DataGridPerfSampleInput = {
  scope: string
  totalMs: number
  ts?: number
  [key: string]: string | number | undefined
}

export type DataGridPerfSummary = {
  scope: string
  count: number
  meanMs: number
  p95Ms: number
  maxMs: number
}

export type DataGridPerfStore = {
  samples: DataGridPerfSample[]
  push: (sample: DataGridPerfSample) => void
  clear: () => void
  latest: (scope?: string) => DataGridPerfSample | null
  summary: () => DataGridPerfSummary[]
}

export function parseDataGridBooleanToken(value: string | null): boolean | null {
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

export function resolveDataGridPerfTraceEnabled(): boolean {
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

export function resolveDataGridPerfNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

export function createDataGridPerfStore(): DataGridPerfStore {
  const samples: DataGridPerfSample[] = []
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

export function resolveDataGridPerfStore(): DataGridPerfStore | null {
  if (typeof window === "undefined") {
    return null
  }
  const perfWindow = window as typeof window & { [DATA_GRID_PERF_STORE_KEY]?: DataGridPerfStore }
  if (!perfWindow[DATA_GRID_PERF_STORE_KEY]) {
    perfWindow[DATA_GRID_PERF_STORE_KEY] = createDataGridPerfStore()
  }
  return perfWindow[DATA_GRID_PERF_STORE_KEY] ?? null
}

export function recordDataGridPerfSample(sample: DataGridPerfSample): void {
  resolveDataGridPerfStore()?.push(sample)
}

export function recordDataGridPerfSampleIfEnabled(
  sample: DataGridPerfSampleInput,
): void {
  if (!resolveDataGridPerfTraceEnabled()) {
    return
  }
  const { ts, ...fields } = sample
  recordDataGridPerfSample({
    ...fields,
    ts: ts ?? resolveDataGridPerfNow(),
  } as DataGridPerfSample)
}
