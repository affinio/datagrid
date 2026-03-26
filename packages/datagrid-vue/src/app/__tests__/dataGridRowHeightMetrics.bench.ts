import { bench, describe } from "vitest"
import { createDataGridAppRowHeightMetrics } from "../dataGridRowHeightMetrics"

const TOTAL_ROWS = 200_000
const BASE_ROW_HEIGHT = 31
const INITIAL_OVERRIDE_COUNT = 5_000
const UPDATE_COUNT = 64
const CLIENT_HEIGHT = 620
const OVERSCAN = 4

function createInitialOverrides(): Map<number, number> {
  const overrides = new Map<number, number>()
  for (let index = 0; index < INITIAL_OVERRIDE_COUNT; index += 1) {
    const rowIndex = index * 11
    overrides.set(rowIndex, BASE_ROW_HEIGHT + 8 + ((index % 5) * 3))
  }
  return overrides
}

function rebuildPrefixOffsets(overrides: ReadonlyMap<number, number>): number[] {
  const prefix = new Array<number>(TOTAL_ROWS + 1)
  prefix[0] = 0
  for (let rowIndex = 0; rowIndex < TOTAL_ROWS; rowIndex += 1) {
    prefix[rowIndex + 1] = prefix[rowIndex] + (overrides.get(rowIndex) ?? BASE_ROW_HEIGHT)
  }
  return prefix
}

function resolveRowIndexAtOffsetFromPrefix(prefix: readonly number[], offset: number): number {
  const totalHeight = prefix[TOTAL_ROWS] ?? 0
  if (totalHeight <= 0) {
    return 0
  }
  const clampedOffset = Math.max(0, Math.min(totalHeight - 1, offset))
  let low = 0
  let high = TOTAL_ROWS - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const rowStart = prefix[middle] ?? 0
    const rowEnd = prefix[middle + 1] ?? totalHeight
    if (clampedOffset < rowStart) {
      high = middle - 1
      continue
    }
    if (clampedOffset >= rowEnd) {
      low = middle + 1
      continue
    }
    return middle
  }

  return Math.max(0, Math.min(TOTAL_ROWS - 1, low))
}

let _sink: unknown

describe("rowHeightMetrics — 64 single-row height updates on 200k rows", () => {
  bench("BEFORE — full prefix rebuild on every row-height mutation", () => {
    const overrides = createInitialOverrides()
    let prefix = rebuildPrefixOffsets(overrides)

    for (let updateIndex = 0; updateIndex < UPDATE_COUNT; updateIndex += 1) {
      const rowIndex = 60_000 + (updateIndex * 37)
      overrides.set(rowIndex, BASE_ROW_HEIGHT + 14 + ((updateIndex % 4) * 4))
      prefix = rebuildPrefixOffsets(overrides)
      const scrollTop = prefix[Math.min(TOTAL_ROWS, rowIndex + 6)] ?? 0
      const start = Math.max(0, resolveRowIndexAtOffsetFromPrefix(prefix, scrollTop) - OVERSCAN)
      const end = Math.min(
        TOTAL_ROWS - 1,
        resolveRowIndexAtOffsetFromPrefix(prefix, scrollTop + CLIENT_HEIGHT - 1) + OVERSCAN,
      )
      _sink = `${start}:${end}:${prefix[TOTAL_ROWS]}`
    }
  })

  bench("AFTER  — sparse chunk mutation + incremental prefix update", () => {
    let version = 1
    let lastMutation: {
      version: number
      kind: "set" | "clear" | "clear-all"
      rowIndex: number | null
      previousHeight: number | null
      nextHeight: number | null
    } | null = null
    const overrides = createInitialOverrides()

    const metrics = createDataGridAppRowHeightMetrics({
      totalRows: () => TOTAL_ROWS,
      resolveBaseRowHeight: () => BASE_ROW_HEIGHT,
      resolveRowHeightOverride: () => null,
      resolveRowHeightVersion: () => version,
      hasRowHeightOverrides: () => overrides.size > 0,
      resolveRowHeightOverridesSnapshot: () => overrides,
      resolveLastRowHeightMutation: () => lastMutation,
    })

    void metrics.resolveTotalHeight()

    for (let updateIndex = 0; updateIndex < UPDATE_COUNT; updateIndex += 1) {
      const rowIndex = 60_000 + (updateIndex * 37)
      const previousHeight = overrides.get(rowIndex) ?? null
      const nextHeight = BASE_ROW_HEIGHT + 14 + ((updateIndex % 4) * 4)
      overrides.set(rowIndex, nextHeight)
      version += 1
      lastMutation = {
        version,
        kind: "set",
        rowIndex,
        previousHeight,
        nextHeight,
      }
      const scrollTop = metrics.resolveRowOffset(Math.min(TOTAL_ROWS - 1, rowIndex + 6))
      const range = metrics.resolveViewportRange(scrollTop, CLIENT_HEIGHT, OVERSCAN)
      _sink = `${range.start}:${range.end}:${metrics.resolveTotalHeight()}`
    }
  })
})

void _sink
