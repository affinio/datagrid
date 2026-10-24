import { describe, expect, it, vi } from "vitest"
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"
import { createDataGridRuntime } from "../runtime/createDataGridRuntime"

describe("createDataGridRuntime disposal contract", () => {
  it("disposes models created and owned by the runtime", async () => {
    const runtime = createDataGridRuntime({ columns: [{ key: "name" }] })
    const disposeRowModel = vi.spyOn(runtime.rowModel, "dispose")
    const disposeColumnModel = vi.spyOn(runtime.columnModel, "dispose")

    await runtime.core.dispose()

    expect(disposeRowModel).toHaveBeenCalledOnce()
    expect(disposeColumnModel).toHaveBeenCalledOnce()
    expect(runtime.core.lifecycle.state).toBe("disposed")
  })

  it("leaves an injected row model under the caller's ownership", async () => {
    const rowModel = createAdvancedClientRowModel({ rows: [] })
    const disposeRowModel = vi.spyOn(rowModel, "dispose")

    const runtime = createDataGridRuntime({ columns: [{ key: "name" }], rowModel })
    await runtime.core.dispose()

    expect(disposeRowModel).not.toHaveBeenCalled()
    rowModel.dispose()
    expect(disposeRowModel).toHaveBeenCalledOnce()
  })

  it("clears row-height overrides when the owned runtime is disposed", async () => {
    const runtime = createDataGridRuntime({ columns: [{ key: "name" }] })
    const viewport = runtime.core.getService("viewport")
    viewport.setRowHeightOverride?.(20_000, 44)
    const overrides = viewport.getRowHeightOverridesSnapshot?.()

    expect(overrides?.size).toBe(1)
    await runtime.core.dispose()

    expect(overrides?.size).toBe(0)
    expect(viewport.getLastRowHeightMutation?.()).toBeNull()
  })
})
