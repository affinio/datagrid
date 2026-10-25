// @vitest-environment jsdom
// Real Vue component integration in jsdom, not browser/visual validation.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { nextTick } from "vue"
import { mkdirSync, writeFileSync } from "node:fs"
import DataGrid from "../../../packages/datagrid-vue/src/app-layer/DataGrid"
import "../../../packages/datagrid-vue/vitest.setup"

const results: Record<string, unknown> = {}
const wrappers: ReturnType<typeof mount>[] = []
const output = process.env.IDENTITY_OUTPUT ?? "/tmp/affino-identity-audit"
const oldRect = HTMLElement.prototype.getBoundingClientRect
const oldScroll = HTMLElement.prototype.scrollIntoView
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 120, height: 32 })
})
afterEach(() => { for (const w of wrappers.splice(0)) w.unmount(); document.body.innerHTML = "" })
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = oldRect; HTMLElement.prototype.scrollIntoView = oldScroll
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/vue.json`, JSON.stringify(results, null, 2))
})
async function settle() { await nextTick(); await Promise.resolve(); await flushPromises(); await nextTick() }
function grid(props: any) { const w = mount(DataGrid, { attachTo: document.body, props }); wrappers.push(w); return w }
const api = (w: ReturnType<typeof mount>) => (w.vm as any).getApi()
const source = (w: ReturnType<typeof mount>) => api(w).rows.get(0)?.data

describe("identity audit: Vue component integration (jsdom)", () => {
  it("deletes only the typed target when numeric and string row IDs stringify identically", async () => {
    const structuralAction = vi.fn()
    const w = grid({ rows: [{ rowId: 1, name: "number" }, { rowId: "1", name: "string" }], columns: [{ key: "name" }], rowSelection: true, rowIndexMenu: { items: ["selection"] }, runStructuralRowAction: structuralAction })
    await settle()
    expect(api(w).rows.getCount()).toBe(2)
    api(w).rowSelection.setSelected(1, true)
    const rowIndexes = w.findAll('.datagrid-stage__row-index-cell[data-row-id="1"]')
    expect(rowIndexes.length).toBe(2)
    await rowIndexes[0]!.trigger("contextmenu", { button: 2, clientX: 90, clientY: 40 }); await settle()
    const deleteAction = document.body.querySelector<HTMLButtonElement>('[data-datagrid-menu-action="delete-selected-rows"]')
    expect(deleteAction).not.toBeNull()
    deleteAction!.dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle()
    expect(structuralAction).toHaveBeenCalled()
    expect(api(w).rows.getCount()).toBe(1)
    expect(api(w).rows.get(0)?.rowId).toBe("1")
    const direct = grid({ rows: [{ rowId: 1, name: "number" }, { rowId: "1", name: "string" }], columns: [{ key: "name" }], rowSelection: true, rowIndexMenu: true })
    await settle(); await (direct.vm as any).runStructuralRowAction("delete-selected-rows", 1); await settle()
    expect(api(direct).rows.getCount()).toBe(1)
    expect(api(direct).rows.get(0)?.rowId).toBe("1")
    results.typedMenuDelete = { inputIds: [1, "1"], target: 1, expectedRemainingIds: ["1"], actualRemainingCount: api(w).rows.getCount(), publicTypedActionRemainingCount: api(direct).rows.getCount() }
  })

  it("observes active draft policy when a retained column key changes source field", async () => {
    const columns = [{ key: "display", field: "old", capabilities: { editable: true } }]
    const w = grid({ rows: [{ rowId: 42, old: "same", next: "same" }], columns })
    await settle()
    await w.find('.grid-body-viewport .grid-cell[data-column-key="display"]').trigger("dblclick"); await settle()
    const editor = w.find<HTMLInputElement>(".cell-editor-input"); expect(editor.exists()).toBe(true)
    await editor.setValue("draft")
    await w.setProps({ columns: [{ ...columns[0], field: "next" }] }); await settle()
    const editorAfterSchema = w.find<HTMLInputElement>(".cell-editor-input")
    if (editorAfterSchema.exists()) { await editorAfterSchema.trigger("blur"); await settle() }
    results.editorSchemaPolicy = { initial: { old: "same", next: "same" }, sameColumnKey: "display", editorSurvivedSchema: editorAfterSchema.exists(), final: source(w), classification: "policy observation; source-field mutation under stable key is not documented" }
    expect(api(w).rows.getCount()).toBe(1)
  })

  it("observes history retention when props replace a record using the same ID", async () => {
    const w = grid({ rows: [{ rowId: 42, name: "A", dataset: "A" }], columns: [{ key: "name", capabilities: { editable: true } }], history: true })
    await settle()
    await w.find('.grid-body-viewport .grid-cell[data-column-key="name"]').trigger("dblclick"); await settle()
    const editor = w.find<HTMLInputElement>(".cell-editor-input"); expect(editor.exists()).toBe(true)
    await editor.setValue("edited-A"); await editor.trigger("blur"); await settle()
    await w.setProps({ rows: [{ rowId: 42, name: "B", dataset: "B" }] }); await settle()
    const beforeUndo = { ...source(w) }
    const undo = await (w.vm as any).history.runHistoryAction("undo"); await settle()
    results.historyReusePolicy = { beforeUndo, undoResult: undo, afterUndo: source(w), classification: "same ID in same mounted runtime means same logical target; dataset boundary policy unspecified" }
    expect(api(w).rows.getCount()).toBe(1)
  })
})
