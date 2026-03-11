import { describe, expect, it } from "vitest"
import { resolveDataGridPerformance } from "../dataGridPerformance"

describe("enterprise performance presets", () => {
  it("defaults boolean enablement to the balanced preset", () => {
    expect(resolveDataGridPerformance(true)).toEqual({
      enabled: true,
      preset: "balanced",
      computeMode: "worker",
      workerPatchDispatchThreshold: 96,
      formulaColumnCacheMaxColumns: 64,
      virtualization: {
        rows: true,
        columns: true,
        rowOverscan: 8,
        columnOverscan: 3,
      },
    })
  })

  it("resolves formulaHeavy preset for formula-intensive workloads", () => {
    expect(resolveDataGridPerformance("formulaHeavy")).toEqual({
      enabled: true,
      preset: "formulaHeavy",
      computeMode: "worker",
      workerPatchDispatchThreshold: 96,
      formulaColumnCacheMaxColumns: 192,
      virtualization: {
        rows: true,
        columns: true,
        rowOverscan: 6,
        columnOverscan: 2,
      },
    })
  })

  it("resolves patchHeavy preset for patch-intensive workloads", () => {
    expect(resolveDataGridPerformance("patchHeavy")).toEqual({
      enabled: true,
      preset: "patchHeavy",
      computeMode: "worker",
      workerPatchDispatchThreshold: 8,
      formulaColumnCacheMaxColumns: 48,
      virtualization: {
        rows: true,
        columns: true,
        rowOverscan: 12,
        columnOverscan: 3,
      },
    })
  })

  it("allows object input to override the selected preset", () => {
    expect(resolveDataGridPerformance({
      preset: "formulaHeavy",
      formulaColumnCacheMaxColumns: 256,
      workerPatchDispatchThreshold: 24,
      virtualization: {
        rows: true,
        columns: false,
        rowOverscan: 18,
      },
    })).toEqual({
      enabled: true,
      preset: "formulaHeavy",
      computeMode: "worker",
      workerPatchDispatchThreshold: 24,
      formulaColumnCacheMaxColumns: 256,
      virtualization: {
        rows: true,
        columns: false,
        rowOverscan: 18,
      },
    })
  })

  it("stays disabled when no enterprise performance config is requested", () => {
    expect(resolveDataGridPerformance(undefined)).toEqual({
      enabled: false,
      preset: "balanced",
    })
  })
})
