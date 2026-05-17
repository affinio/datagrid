import { beforeEach, describe, expect, it } from "vitest"
import {
  recordDataGridInteractionCancel,
  recordDataGridInteractionOwnerTransition,
  recordDataGridInteractionPreviewTiming,
  resolveDataGridInteractionDiagnosticsEnabled,
} from "../dataGridInteractionDiagnostics"
import type { DataGridAppInteractionOwnerSnapshot } from "../dataGridInteractionOwner"

const DATA_GRID_PERF_STORE_KEY = "__AFFINO_DATAGRID_PERF__"

function readPerfSamples(): Array<Record<string, unknown>> {
  return ((window as unknown as {
    [DATA_GRID_PERF_STORE_KEY]?: { samples?: Array<Record<string, unknown>> }
  })[DATA_GRID_PERF_STORE_KEY]?.samples) ?? []
}

function snapshot(owner: DataGridAppInteractionOwnerSnapshot["owner"]): DataGridAppInteractionOwnerSnapshot {
  return {
    owner,
    activeOwners: owner ? [owner] : [],
    hasConflict: false,
  }
}

describe("dataGridInteractionDiagnostics", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
    window.history.replaceState({}, "", "/")
    window.localStorage.clear()
  })

  it("does not emit samples while perf tracing is disabled", () => {
    expect(resolveDataGridInteractionDiagnosticsEnabled()).toBe(false)

    recordDataGridInteractionOwnerTransition(snapshot(null), snapshot("range-move"))
    recordDataGridInteractionCancel("pointercancel", false, snapshot("range-move"))
    recordDataGridInteractionPreviewTiming("range-move", 2)

    expect(readPerfSamples()).toEqual([])
  })

  it("emits owner transition and cancellation samples when tracing is enabled", () => {
    window.history.replaceState({}, "", "/?dgPerfTrace=1")

    recordDataGridInteractionOwnerTransition(snapshot(null), snapshot("range-move"))
    recordDataGridInteractionCancel("contextmenu", true, snapshot("range-move"))

    expect(readPerfSamples()).toEqual([
      expect.objectContaining({
        scope: "interactionOwner",
        previousOwner: "none",
        owner: "range-move",
        activeOwners: "range-move",
        conflict: 0,
      }),
      expect.objectContaining({
        scope: "interactionCancel",
        reason: "contextmenu",
        commit: 1,
        owner: "range-move",
      }),
    ])
  })
})
