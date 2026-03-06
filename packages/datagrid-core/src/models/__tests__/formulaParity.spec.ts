import { describe, expect, it } from "vitest"
import { createClientRowModel } from "../clientRowModel.js"

interface FormulaParityRow {
  id: number
  price: number
  qty: number
  taxRate: number
  shipping: number
  discount: number
  fee: number
  orders: number
  returns: number
  subtotal?: number
  tax?: number
  gross?: number
  net?: number
  velocity?: number
  score?: number
  ratio?: number
  health?: number
}

interface FormulaParityExpected {
  subtotal: number
  tax: number
  gross: number
  net: number
  velocity: number
  score: number
  ratio: number
  health: number
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

function buildRows(rowCount: number, seed: number): FormulaParityRow[] {
  const rng = createRng(seed)
  return Array.from({ length: rowCount }, (_, index) => ({
    id: index + 1,
    price: 10 + rng() * 500,
    qty: 1 + Math.floor(rng() * 10),
    taxRate: 0.02 + rng() * 0.2,
    shipping: rng() * 50,
    discount: 0.5 + rng() * 0.5,
    fee: rng() * 5,
    orders: 10 + Math.floor(rng() * 500),
    returns: Math.floor(rng() * 10),
  }))
}

function computeExpected(row: FormulaParityRow): FormulaParityExpected {
  const subtotal = row.price * row.qty
  const tax = subtotal * row.taxRate
  const gross = subtotal + tax + row.shipping
  const net = gross * row.discount + row.fee
  const velocity = row.orders - row.returns
  const score = net + velocity
  const ratio = row.qty === 0 ? 0 : (subtotal / row.qty)
  const health = score > 1000 ? 1 : 0
  return {
    subtotal,
    tax,
    gross,
    net,
    velocity,
    score,
    ratio,
    health,
  }
}

function assertRowParity(actualRow: FormulaParityRow | undefined, sourceRow: FormulaParityRow): void {
  expect(actualRow).toBeDefined()
  if (!actualRow) {
    return
  }
  const expected = computeExpected(sourceRow)
  expect(actualRow.subtotal ?? 0).toBeCloseTo(expected.subtotal, 8)
  expect(actualRow.tax ?? 0).toBeCloseTo(expected.tax, 8)
  expect(actualRow.gross ?? 0).toBeCloseTo(expected.gross, 8)
  expect(actualRow.net ?? 0).toBeCloseTo(expected.net, 8)
  expect(actualRow.velocity ?? 0).toBeCloseTo(expected.velocity, 8)
  expect(actualRow.score ?? 0).toBeCloseTo(expected.score, 8)
  expect(actualRow.ratio ?? 0).toBeCloseTo(expected.ratio, 8)
  expect(actualRow.health ?? 0).toBe(expected.health)
}

function createFormulaParityModel(rows: FormulaParityRow[]) {
  return createClientRowModel<FormulaParityRow>({
    rows: rows.map((row, index) => ({
      row,
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    })),
    initialFormulaFields: [
      { name: "subtotal", formula: "price * qty" },
      { name: "tax", formula: "subtotal * taxRate" },
      { name: "gross", formula: "subtotal + tax + shipping" },
      { name: "net", formula: "gross * discount + fee" },
      { name: "velocity", formula: "orders - returns" },
      { name: "score", formula: "net + velocity" },
      { name: "ratio", formula: "subtotal / qty" },
      { name: "health", formula: "score > 1000" },
    ],
  })
}

describe("formula parity", () => {
  it("matches manual compute baseline on initial projection", () => {
    const rows = buildRows(256, 1337)
    const model = createFormulaParityModel(rows)
    for (let index = 0; index < rows.length; index += 1) {
      const sourceRow = rows[index]
      const modelRow = model.getRow(index)?.row as FormulaParityRow | undefined
      assertRowParity(modelRow, sourceRow)
    }
    model.dispose()
  })

  it("keeps parity under incremental patch bursts (1/10/100/1000)", () => {
    const rows = buildRows(2048, 2026)
    const model = createFormulaParityModel(rows)
    const rng = createRng(7331)
    const patchSizes = [1, 10, 100, 1000]

    for (const requestedPatchSize of patchSizes) {
      const patchSize = Math.min(requestedPatchSize, rows.length)
      const selectedIndexes = new Set<number>()
      while (selectedIndexes.size < patchSize) {
        selectedIndexes.add(randomInt(rng, 0, rows.length - 1))
      }

      const updates: Array<{ rowId: number; data: Partial<FormulaParityRow> }> = []
      for (const index of selectedIndexes) {
        const row = rows[index]
        if (!row) {
          continue
        }
        row.price = row.price + 1 + rng() * 0.01
        row.qty = rng() < 0.1 ? 0 : (Math.max(1, (row.qty + 1) % 10))
        row.taxRate = Math.max(0, Math.min(1, row.taxRate + (rng() - 0.5) * 0.02))
        row.discount = Math.max(0, Math.min(1, row.discount + (rng() - 0.5) * 0.02))
        row.orders = Math.max(0, row.orders + randomInt(rng, -2, 3))
        row.returns = Math.max(0, row.returns + randomInt(rng, -1, 1))
        updates.push({
          rowId: row.id,
          data: {
            price: row.price,
            qty: row.qty,
            taxRate: row.taxRate,
            discount: row.discount,
            orders: row.orders,
            returns: row.returns,
          },
        })
      }

      model.patchRows(updates, {
        recomputeSort: false,
        recomputeFilter: false,
        recomputeGroup: false,
        emit: false,
      })

      for (let index = 0; index < rows.length; index += 1) {
        const sourceRow = rows[index]
        const modelRow = model.getRow(index)?.row as FormulaParityRow | undefined
        assertRowParity(modelRow, sourceRow)
      }
    }

    model.dispose()
  })

  it("keeps parity after explicit full recompute", () => {
    const rows = buildRows(512, 9001)
    const model = createFormulaParityModel(rows)
    model.recomputeComputedFields()
    for (let index = 0; index < rows.length; index += 1) {
      const sourceRow = rows[index]
      const modelRow = model.getRow(index)?.row as FormulaParityRow | undefined
      assertRowParity(modelRow, sourceRow)
    }
    model.dispose()
  })
})
