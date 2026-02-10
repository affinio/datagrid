import { describe, expect, it } from "vitest"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import type { VisibleRow } from "../../types"
import { createDataGridViewportModelBridgeService } from "../dataGridViewportModelBridgeService"

interface BridgeRow {
  id: number
  value: string
}

function createRng(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) {
    state += 2147483646
  }
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function randomInt(rng: () => number, min: number, max: number): number {
  const span = Math.max(1, max - min + 1)
  return min + Math.floor(rng() * span)
}

function buildRows(count: number, offset = 0): VisibleRow<BridgeRow>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = offset + index
    return {
      row: { id, value: `row-${id}` },
      rowId: id,
      originalIndex: index,
      displayIndex: index,
    }
  })
}

describe("table viewport model bridge property contract", () => {
  it("keeps boundary mapping deterministic under randomized range demand", () => {
    const seeds = [1337, 7331, 2026]
    for (const seed of seeds) {
      const rng = createRng(seed)
      const initialCount = randomInt(rng, 50, 220)
      const rowModel = createClientRowModel<BridgeRow>({
        rows: buildRows(initialCount),
      })
      const columnModel = createDataGridColumnModel({
        columns: [{ key: "value", label: "Value", width: 180 }],
      })
      const fallbackRowModel = createClientRowModel()
      const fallbackColumnModel = createDataGridColumnModel()

      const bridge = createDataGridViewportModelBridgeService({
        initialRowModel: rowModel,
        initialColumnModel: columnModel,
        fallbackRowModel,
        fallbackColumnModel,
        onInvalidate: (_reason) => {},
      })

      try {
        for (let step = 0; step < 260; step += 1) {
          if (step % 41 === 0) {
            const nextCount = randomInt(rng, 0, 260)
            const offset = randomInt(rng, 0, 20_000)
            rowModel.setRows(buildRows(nextCount, offset))
          }

          const rowCount = bridge.getRowCount()
          const start = randomInt(rng, -32, rowCount + 32)
          const end = randomInt(rng, -32, rowCount + 32)
          const range = bridge.getRowsInRange({ start, end })

          for (const row of range) {
            expect(row.displayIndex).toBeGreaterThanOrEqual(0)
            expect(row.originalIndex).toBeGreaterThanOrEqual(0)
            expect(row.displayIndex).toBe(row.originalIndex)
            expect(typeof row.rowId === "number" || typeof row.rowId === "string").toBe(true)
          }

          if (rowCount > 0) {
            const probe = randomInt(rng, 0, rowCount - 1)
            const first = bridge.getRow(probe)
            const second = bridge.getRow(probe)
            expect(second).toBe(first)
          } else {
            expect(bridge.getRow(0)).toBeUndefined()
          }
        }
      } finally {
        bridge.dispose()
        rowModel.dispose()
        columnModel.dispose()
        fallbackRowModel.dispose()
        fallbackColumnModel.dispose()
      }
    }
  })
})

