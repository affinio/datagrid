import { describe, expect, it, vi } from "vitest"
import { createClientRowLifecycle } from "../clientRowLifecycle"
import type { DataGridRowModelSnapshot } from "../rowModel"

interface RowData {
  id: number
}

function createSnapshot(revision: number): DataGridRowModelSnapshot<RowData> {
  return {
    revision,
    kind: "client",
    rowCount: 0,
    loading: false,
    error: null,
    projection: {
      version: revision,
      staleStages: [],
    },
    viewportRange: { start: 0, end: 0 },
    pagination: {
      enabled: false,
      pageSize: 0,
      currentPage: 0,
      pageCount: 0,
      totalRowCount: 0,
      startIndex: -1,
      endIndex: -1,
    },
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: {
      expandedByDefault: false,
      toggledGroupKeys: [],
    },
  }
}

describe("clientRowLifecycle", () => {
  it("emits snapshots to active subscribers and stops after dispose", () => {
    const lifecycle = createClientRowLifecycle<RowData>()
    const listener = vi.fn()
    lifecycle.subscribe(listener)

    lifecycle.emit(() => createSnapshot(1))
    expect(listener).toHaveBeenCalledTimes(1)

    expect(lifecycle.dispose()).toBe(true)
    lifecycle.emit(() => createSnapshot(2))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(lifecycle.dispose()).toBe(false)
  })

  it("ensureActive throws after dispose", () => {
    const lifecycle = createClientRowLifecycle<RowData>()
    lifecycle.ensureActive()
    lifecycle.dispose()

    expect(() => lifecycle.ensureActive()).toThrow(/disposed/i)
  })
})
