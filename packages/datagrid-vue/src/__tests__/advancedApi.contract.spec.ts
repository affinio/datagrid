import { describe, expect, it } from "vitest"
import * as advancedEntrypoint from "../advanced"
import * as stableEntrypoint from "../stable"

describe("datagrid-vue advanced api contract", () => {
  it("exports advanced hooks from explicit advanced entrypoint", () => {
    expect(typeof advancedEntrypoint.useDataGridViewportBridge).toBe("function")
    expect(typeof advancedEntrypoint.useDataGridHeaderOrchestration).toBe("function")
    expect(typeof advancedEntrypoint.createDataGridHeaderBindings).toBe("function")
    expect(typeof advancedEntrypoint.useDataGridRowSelectionFacade).toBe("function")
    expect(typeof advancedEntrypoint.useDataGridFindReplaceFacade).toBe("function")
  })

  it("does not leak advanced hooks through stable entrypoint", () => {
    expect("useDataGridViewportBridge" in stableEntrypoint).toBe(false)
    expect("useDataGridHeaderOrchestration" in stableEntrypoint).toBe(false)
    expect("createDataGridHeaderBindings" in stableEntrypoint).toBe(false)
    expect("useDataGridRowSelectionFacade" in stableEntrypoint).toBe(false)
    expect("useDataGridFindReplaceFacade" in stableEntrypoint).toBe(false)
  })
})
