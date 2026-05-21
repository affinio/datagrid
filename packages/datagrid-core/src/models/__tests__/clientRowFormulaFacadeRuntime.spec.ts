import { describe, expect, it, vi } from "vitest"
import { createClientRowFormulaFacadeRuntime } from "../host/clientRowFormulaFacadeRuntime.js"

describe("createClientRowFormulaFacadeRuntime", () => {
  it("delegates formula module and table methods", () => {
    const module = {
      registerComputedField: vi.fn(),
      registerFormulaField: vi.fn(),
      getComputedFields: vi.fn(() => [{ name: "total", field: "total", deps: [] }]),
      getFormulaFields: vi.fn(() => [{ name: "tax", field: "tax", formula: "1", deps: [], contextKeys: [] }]),
      registerFormulaFunction: vi.fn(),
      unregisterFormulaFunction: vi.fn(() => true),
      getFormulaFunctionNames: vi.fn(() => ["SUM"]),
      getFormulaExecutionPlan: vi.fn(() => null),
      getFormulaGraph: vi.fn(() => null),
      getFormulaComputeStageDiagnostics: vi.fn(() => null),
      getFormulaRowRecomputeDiagnostics: vi.fn(() => null),
      recomputeComputedFields: vi.fn(() => 2),
      recomputeFormulaContext: vi.fn(() => 3),
    }
    const formulaTableHostRuntime = {
      setFormulaTable: vi.fn(),
      patchFormulaTables: vi.fn(() => true),
      removeFormulaTable: vi.fn(() => true),
      getFormulaTableNames: vi.fn(() => ["orders"]),
    }
    const runtime = createClientRowFormulaFacadeRuntime<{ id: string }>({
      resolveFormulaModule: () => module,
      formulaTableHostRuntime,
    })

    expect(runtime.getComputedFields()).toEqual([{ name: "total", field: "total", deps: [] }])
    expect(runtime.getFormulaFields()).toEqual([{ name: "tax", field: "tax", formula: "1", deps: [], contextKeys: [] }])
    expect(runtime.unregisterFormulaFunction("OLD")).toBe(true)
    expect(runtime.getFormulaFunctionNames()).toEqual(["SUM"])
    expect(runtime.recomputeComputedFields(["r1"])).toBe(2)
    expect(runtime.recomputeFormulaContext({ contextKeys: ["tables"] })).toBe(3)
    runtime.setFormulaTable("orders", [])
    expect(runtime.patchFormulaTables({ remove: ["orders"] })).toBe(true)
    expect(runtime.removeFormulaTable("orders")).toBe(true)
    expect(runtime.getFormulaTableNames()).toEqual(["orders"])

    expect(module.recomputeComputedFields).toHaveBeenCalledWith(["r1"])
    expect(formulaTableHostRuntime.setFormulaTable).toHaveBeenCalledWith("orders", [])
  })
})
