import { describe, expect, it } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-vue/headless"
import { resolveKeyboardColumnWidth } from "../dataGridKeyboardColumnResize"

function column(key: string, width: number, options: {
  pin?: "left" | "center" | "right"
  minWidth?: number
  maxWidth?: number
  isSystem?: boolean
} = {}): DataGridColumnSnapshot {
  return {
    key,
    pin: options.pin ?? "center",
    width,
    column: {
      key,
      label: key,
      minWidth: options.minWidth,
      maxWidth: options.maxWidth,
      meta: options.isSystem ? { isSystem: true } : undefined,
    },
  } as unknown as DataGridColumnSnapshot
}

describe("keyboard column resize", () => {
  const options = { defaultWidth: 140, minWidth: 80 }

  it("changes only the focused column and caps growth before the right neighbor minimum", () => {
    const columns = [column("active", 100), column("next", 90, { minWidth: 80 })]
    expect(resolveKeyboardColumnWidth(columns, "active", 1, options)).toBe(110)
    expect(columns[1]?.width).toBe(90)
  })

  it("honors the focused column min and max widths", () => {
    expect(resolveKeyboardColumnWidth([
      column("active", 120, { minWidth: 100, maxWidth: 125 }),
      column("next", 140),
    ], "active", 1, options)).toBe(125)
    expect(resolveKeyboardColumnWidth([
      column("active", 85, { minWidth: 80 }),
      column("next", 140),
    ], "active", -1, options)).toBe(80)
  })

  it("does not use a neighbor across pinned panes or resize system columns", () => {
    expect(resolveKeyboardColumnWidth([
      column("active", 100, { pin: "center" }),
      column("right", 90, { pin: "right", minWidth: 80 }),
    ], "active", 1, options)).toBe(110)
    expect(resolveKeyboardColumnWidth([
      column("system", 40, { pin: "left", isSystem: true }),
      column("active", 100),
    ], "system", 1, options)).toBeNull()
  })
})
