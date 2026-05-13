import type { DataGridViewportRange } from "../rowModel.js"

export interface DataGridVelocityOverscanSample {
  range: DataGridViewportRange
  timestampMs: number
}

export interface DataGridVelocityOverscanOptions {
  baseRows?: number
  expectedLoadMs?: number
  maxRows?: number
  minSampleMs?: number
  forwardRatio?: number
  totalRows?: number | null
}

export interface DataGridVelocityOverscanResult {
  range: DataGridViewportRange
  direction: -1 | 0 | 1
  velocityRowsPerMs: number
  overscanRows: number
  leadingRows: number
  trailingRows: number
}

const DEFAULT_EXPECTED_LOAD_MS = 180
const DEFAULT_MAX_ROWS = 512
const DEFAULT_MIN_SAMPLE_MS = 4
const DEFAULT_FORWARD_RATIO = 0.75

function normalizeIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function normalizeRange(range: DataGridViewportRange): DataGridViewportRange {
  const start = normalizeIndex(range.start)
  const end = normalizeIndex(range.end)
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  }
}

function normalizeCount(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.max(0, Math.trunc(value as number))
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.max(min, Math.min(max, value))
}

function resolveDirection(current: DataGridViewportRange, previous: DataGridViewportRange | null): -1 | 0 | 1 {
  if (!previous) {
    return 0
  }
  if (current.start > previous.start) {
    return 1
  }
  if (current.start < previous.start) {
    return -1
  }
  if (current.end > previous.end) {
    return 1
  }
  if (current.end < previous.end) {
    return -1
  }
  return 0
}

function distributeOverscan(overscanRows: number, direction: -1 | 0 | 1, forwardRatio: number) {
  if (overscanRows <= 0) {
    return { leadingRows: 0, trailingRows: 0 }
  }
  if (direction === 0) {
    const leadingRows = Math.floor(overscanRows / 2)
    return {
      leadingRows,
      trailingRows: overscanRows - leadingRows,
    }
  }
  const trailingRatio = direction > 0 ? forwardRatio : 1 - forwardRatio
  const trailingRows = Math.ceil(overscanRows * trailingRatio)
  return {
    leadingRows: overscanRows - trailingRows,
    trailingRows,
  }
}

export function resolveDataGridVelocityOverscanRange(
  sample: DataGridVelocityOverscanSample,
  previousSample: DataGridVelocityOverscanSample | null,
  options: DataGridVelocityOverscanOptions = {},
): DataGridVelocityOverscanResult {
  const range = normalizeRange(sample.range)
  const previousRange = previousSample ? normalizeRange(previousSample.range) : null
  const baseRows = Number.isFinite(options.baseRows)
    ? Math.max(0, Math.trunc(options.baseRows as number))
    : 0
  const expectedLoadMs = Number.isFinite(options.expectedLoadMs) && (options.expectedLoadMs as number) > 0
    ? options.expectedLoadMs as number
    : DEFAULT_EXPECTED_LOAD_MS
  const maxRows = Number.isFinite(options.maxRows) && (options.maxRows as number) >= 0
    ? Math.max(baseRows, Math.trunc(options.maxRows as number))
    : Math.max(baseRows, DEFAULT_MAX_ROWS)
  const minSampleMs = Number.isFinite(options.minSampleMs) && (options.minSampleMs as number) > 0
    ? options.minSampleMs as number
    : DEFAULT_MIN_SAMPLE_MS
  const forwardRatio = clamp(options.forwardRatio ?? DEFAULT_FORWARD_RATIO, 0.5, 1)
  const direction = resolveDirection(range, previousRange)
  const elapsedMs = previousSample
    ? sample.timestampMs - previousSample.timestampMs
    : 0
  const deltaRows = previousRange
    ? Math.abs(range.start - previousRange.start)
    : 0
  const velocityRowsPerMs = previousRange && elapsedMs >= minSampleMs && deltaRows > 0
    ? deltaRows / elapsedMs
    : 0
  const dynamicRows = Math.ceil(velocityRowsPerMs * expectedLoadMs)
  const overscanRows = clamp(baseRows + dynamicRows, baseRows, maxRows)
  const { leadingRows, trailingRows } = distributeOverscan(overscanRows, direction, forwardRatio)
  const totalRows = normalizeCount(options.totalRows)
  const endLimit = totalRows == null || totalRows <= 0 ? Number.POSITIVE_INFINITY : totalRows - 1

  return {
    range: {
      start: Math.max(0, range.start - leadingRows),
      end: Math.min(endLimit, range.end + trailingRows),
    },
    direction,
    velocityRowsPerMs,
    overscanRows,
    leadingRows,
    trailingRows,
  }
}
