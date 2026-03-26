/**
 * Performance benchmarks for useDataGridAppViewport hot-path algorithms.
 *
 * Each suite runs the NAIVE (before) algorithm against the OPTIMIZED (after) algorithm
 * so a single `vitest bench` run shows the speedup without needing a separate baseline commit.
 *
 * Run:  pnpm vitest bench packages/datagrid-vue/src/app/__tests__/useDataGridAppViewport.bench.ts
 */

import { bench, describe } from "vitest"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const COLUMN_COUNT = 200
const COLUMN_WIDTH = 140
const DEFAULT_WIDTH = 140

/** Simulate `sizingColumns` snapshot */
const columns = Array.from({ length: COLUMN_COUNT }, (_, i) => ({
  key: `col-${i}`,
  width: COLUMN_WIDTH,
}))

/** Simulate `effectiveColumnWidths` record — key → resolved pixel width */
const widthRecord: Record<string, number> = {}
for (const col of columns) {
  widthRecord[col.key] = col.width
}

/** Prefix sum array: prefixWidths[i] = left edge (px) of column i */
// Typed as a tuple-like readonly array so index access stays `number` not `number | undefined`.
const prefixWidthsArr: number[] = new Array<number>(COLUMN_COUNT + 1).fill(0)
for (let i = 0; i < COLUMN_COUNT; i++) {
  // Non-null assertions: indices are provably within bounds (0..COLUMN_COUNT).
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  prefixWidthsArr[i + 1] = prefixWidthsArr[i]! + (widthRecord[columns[i]!.key] ?? DEFAULT_WIDTH)
}
const prefixWidths = prefixWidthsArr as readonly number[]

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const totalWidth: number = prefixWidths[COLUMN_COUNT]!

// Viewport scrolled to the middle horizontally
const VIEWPORT_WIDTH = 800
const SCROLL_LEFT = Math.floor(totalWidth / 2)
const COLUMN_OVERSCAN = 2

// Target key for columnStyle benchmark (middle of array — worst case for find)
const TARGET_KEY = `col-${Math.floor(COLUMN_COUNT / 2)}`

// Sink variable: bench functions must return void; we assign results here to
// prevent the JS engine from dead-code-eliminating the measured work.
let _sink: unknown

// ---------------------------------------------------------------------------
// Suite 1 — columnStyle(): Array.find() O(n) vs Record lookup O(1)
//
// Each call to columnStyle() is made once per visible cell per render frame.
// With 20 rows × 10 visible columns = 200 calls per frame.
// We benchmark 10 000 calls to amplify the difference.
// ---------------------------------------------------------------------------

describe("columnStyle() lookup — 10 000 calls on 200-column grid", () => {
  const CALLS = 10_000

  bench("BEFORE — Array.find() O(n)", () => {
    let w = 0
    for (let c = 0; c < CALLS; c++) {
      const col = columns.find(candidate => candidate.key === TARGET_KEY)
      w = col !== undefined ? (widthRecord[col.key] ?? DEFAULT_WIDTH) : DEFAULT_WIDTH
    }
    _sink = w
  })

  bench("AFTER  — Record[key] O(1)", () => {
    let w = 0
    for (let c = 0; c < CALLS; c++) {
      w = widthRecord[TARGET_KEY] ?? DEFAULT_WIDTH
    }
    _sink = w
  })
})

// ---------------------------------------------------------------------------
// Suite 2 — snapshotColumnWidths build: Object.fromEntries+map vs plain loop
//
// Runs once whenever sizingColumns changes (e.g. column resize, add/remove).
// ---------------------------------------------------------------------------

describe("snapshotColumnWidths build — 200 columns", () => {
  bench("BEFORE — Object.fromEntries(array.map(...))", () => {
    _sink = Object.fromEntries(
      columns.map(col => [col.key, col.width ?? DEFAULT_WIDTH]),
    )
  })

  bench("AFTER  — plain for-loop into object literal", () => {
    const result: Record<string, number> = {}
    for (const col of columns) {
      result[col.key] = col.width ?? DEFAULT_WIDTH
    }
    _sink = result
  })
})

// ---------------------------------------------------------------------------
// Suite 3 — viewportColumnMetrics: linear scan O(n) vs binary search O(log n)
//
// Runs on every horizontal scroll event (RAF-scheduled, but still hot).
// Benchmarked at 1 000 recomputes to simulate rapid horizontal scrolling.
// ---------------------------------------------------------------------------

describe("viewportColumnMetrics — 1 000 horizontal scroll recomputes on 200-column grid", () => {
  const RECOMPUTES = 1_000

  bench("BEFORE — linear scan O(n) + O(n) spacer sum", () => {
    let result = { start: 0, end: 0, leftSpacerWidth: 0, rightSpacerWidth: 0 }

    for (let r = 0; r < RECOMPUTES; r++) {
      const viewportStartPx = SCROLL_LEFT
      const viewportEndPx = SCROLL_LEFT + VIEWPORT_WIDTH

      // --- find visibleStart (linear) ---
      let runningWidth = 0
      let visibleStart = 0
      while (visibleStart < COLUMN_COUNT) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const colWidth = widthRecord[columns[visibleStart]!.key] ?? DEFAULT_WIDTH
        if (runningWidth + colWidth > viewportStartPx) break
        runningWidth += colWidth
        visibleStart++
      }

      if (visibleStart >= COLUMN_COUNT) {
        const lastIndex = COLUMN_COUNT - 1
        let leftSpacerWidth = 0
        for (let i = 0; i < lastIndex; i++) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          leftSpacerWidth += widthRecord[columns[i]!.key] ?? DEFAULT_WIDTH
        }
        result = { start: lastIndex, end: lastIndex, leftSpacerWidth, rightSpacerWidth: 0 }
        continue
      }

      // --- find visibleEnd (linear) ---
      let visibleEnd = visibleStart
      let coveredWidth = runningWidth
      while (visibleEnd < COLUMN_COUNT) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        coveredWidth += widthRecord[columns[visibleEnd]!.key] ?? DEFAULT_WIDTH
        if (coveredWidth >= viewportEndPx) break
        visibleEnd++
      }

      const start = Math.max(0, visibleStart - COLUMN_OVERSCAN)
      const end = Math.min(COLUMN_COUNT - 1, visibleEnd + COLUMN_OVERSCAN)

      // --- spacer widths (linear) ---
      let leftSpacerWidth = 0
      for (let i = 0; i < start; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        leftSpacerWidth += widthRecord[columns[i]!.key] ?? DEFAULT_WIDTH
      }
      let renderedWidth = 0
      for (let i = start; i <= end; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        renderedWidth += widthRecord[columns[i]!.key] ?? DEFAULT_WIDTH
      }
      const rightSpacerWidth = Math.max(0, totalWidth - leftSpacerWidth - renderedWidth)

      result = { start, end, leftSpacerWidth, rightSpacerWidth }
    }

    _sink = result
  })

  bench("AFTER  — binary search O(log n) + O(1) spacer from prefix sums", () => {
    let result = { start: 0, end: 0, leftSpacerWidth: 0, rightSpacerWidth: 0 }

    for (let r = 0; r < RECOMPUTES; r++) {
      const viewportStartPx = SCROLL_LEFT
      const viewportEndPx = SCROLL_LEFT + VIEWPORT_WIDTH

      // --- find visibleStart (binary search) ---
      let lo = 0
      let hi = COLUMN_COUNT
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (prefixWidths[mid + 1]! <= viewportStartPx) lo = mid + 1
        else hi = mid
      }
      const visibleStart = lo

      if (visibleStart >= COLUMN_COUNT) {
        const lastIndex = COLUMN_COUNT - 1
        result = {
          start: lastIndex,
          end: lastIndex,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          leftSpacerWidth: prefixWidths[lastIndex]!,
          rightSpacerWidth: 0,
        }
        continue
      }

      // --- find visibleEnd (binary search) ---
      lo = visibleStart
      hi = COLUMN_COUNT - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (prefixWidths[mid]! < viewportEndPx) lo = mid
        else hi = mid - 1
      }
      const visibleEnd = lo

      const start = Math.max(0, visibleStart - COLUMN_OVERSCAN)
      const end = Math.min(COLUMN_COUNT - 1, visibleEnd + COLUMN_OVERSCAN)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const leftSpacerWidth = prefixWidths[start]!
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const renderedWidth = prefixWidths[end + 1]! - prefixWidths[start]!
      const rightSpacerWidth = Math.max(0, totalWidth - leftSpacerWidth - renderedWidth)

      result = { start, end, leftSpacerWidth, rightSpacerWidth }
    }

    _sink = result
  })
})

// ---------------------------------------------------------------------------
// Suite 4 — mainTrackWidth: reduce O(n) vs prefix tail O(1)
//
// Recomputed whenever columns change or viewport resizes.
// ---------------------------------------------------------------------------

describe("mainTrackWidth — 200 columns", () => {
  bench("BEFORE — Array.reduce() O(n)", () => {
    _sink = columns.reduce((sum, col) => sum + (widthRecord[col.key] ?? DEFAULT_WIDTH), 0)
  })

  bench("AFTER  — prefix tail O(1)", () => {
    _sink = prefixWidths[prefixWidths.length - 1] ?? 0
  })
})

// ---------------------------------------------------------------------------
// Suite 5 — visible-row sync: full window rebuild vs incremental overlap reuse
//
// Simulates 1 000 consecutive scroll steps where the viewport moves by one row.
// ---------------------------------------------------------------------------

describe("visible-row sync — 1 000 one-row window shifts", () => {
  const ROW_COUNT = 100_000
  const WINDOW_SIZE = 80
  const SHIFTS = 1_000
  const rows = Array.from({ length: ROW_COUNT }, (_, index) => ({ rowId: `row-${index}` }))

  bench("BEFORE — rebuild full visible window on every shift", () => {
    let start = 0
    let visibleRows: { rowId: string }[] = rows.slice(0, WINDOW_SIZE)

    for (let shift = 0; shift < SHIFTS; shift += 1) {
      start += 1
      const nextRows: { rowId: string }[] = []
      for (let rowIndex = start; rowIndex < start + WINDOW_SIZE; rowIndex += 1) {
        const row = rows[rowIndex]
        if (row) {
          nextRows.push(row)
        }
      }
      visibleRows = nextRows
    }

    _sink = visibleRows
  })

  bench("AFTER  — reuse overlap and fetch only delta rows", () => {
    let start = 0
    let visibleRows: { rowId: string }[] = rows.slice(0, WINDOW_SIZE)

    for (let shift = 0; shift < SHIFTS; shift += 1) {
      const nextStart = start + 1
      const nextRows = visibleRows.slice(1)
      const appendedRow = rows[nextStart + WINDOW_SIZE - 1]
      if (appendedRow) {
        nextRows.push(appendedRow)
      }
      visibleRows = nextRows
      start = nextStart
    }

    _sink = visibleRows
  })
})

// Read once so TypeScript does not warn "declared but never read".
// Has no runtime effect; V8 will eliminate this check.
void _sink
