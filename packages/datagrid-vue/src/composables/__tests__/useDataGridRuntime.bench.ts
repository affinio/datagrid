import { bench, describe } from "vitest"

const TOTAL_ROWS = 10_000
const BODY_WINDOW = 80
const SYNCS = 1_000
const PIN_INTERVAL = 24

const allRows: Array<{ rowId: string }> = []
const bodyRows: Array<{ rowId: string }> = []
const bodyDisplayIndexes: number[] = []

for (let index = 0; index < TOTAL_ROWS; index += 1) {
  const row = { rowId: `row-${index}` }
  allRows.push(row)
  if ((index + 1) % PIN_INTERVAL === 0) {
    continue
  }
  bodyRows.push(row)
  bodyDisplayIndexes.push(index)
}

const maxStart = Math.max(0, bodyRows.length - BODY_WINDOW)

let _sink: unknown

describe("syncBodyRowsInRange — 1 000 body-window syncs on 10k-row partition", () => {
  bench("BEFORE — per-row displayIndex lookup and push", () => {
    let start = 0
    let rowsInRange: Array<{ rowId: string }> = []

    for (let syncIndex = 0; syncIndex < SYNCS; syncIndex += 1) {
      const end = Math.min(bodyDisplayIndexes.length - 1, start + BODY_WINDOW - 1)
      const nextRows: Array<{ rowId: string }> = []
      for (let bodyIndex = start; bodyIndex <= end; bodyIndex += 1) {
        const displayIndex = bodyDisplayIndexes[bodyIndex]
        if (typeof displayIndex !== "number") {
          continue
        }
        const row = allRows[displayIndex]
        if (row) {
          nextRows.push(row)
        }
      }
      rowsInRange = nextRows
      start = start >= maxStart ? 0 : start + 1
    }

    _sink = rowsInRange
  })

  bench("AFTER  — contiguous bodyRows.slice()", () => {
    let start = 0
    let rowsInRange: Array<{ rowId: string }> = []

    for (let syncIndex = 0; syncIndex < SYNCS; syncIndex += 1) {
      const endExclusive = Math.min(bodyRows.length, start + BODY_WINDOW)
      rowsInRange = bodyRows.slice(start, endExclusive)
      start = start >= maxStart ? 0 : start + 1
    }

    _sink = rowsInRange
  })
})

void _sink
