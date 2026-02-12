import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { createClientRowModel } from "@affino/datagrid-core"
import { useAffinoDataGrid } from "../useAffinoDataGrid"

interface GridRow {
  rowId: string
  service: string
  owner: string
}

const COLUMNS = [
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
] as const

async function flushTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("useAffinoDataGrid contract", () => {
  it("applies tree groupSelectsChildren policy in sugar cell selection", async () => {
    const treeRows = ref([
      { rowId: "r1", path: ["eu", "payments"], service: "payments-api", owner: "NOC" },
      { rowId: "r2", path: ["eu", "payments"], service: "billing-worker", owner: "Payments" },
      { rowId: "r3", path: ["us", "core"], service: "incident-timeline", owner: "Core" },
    ])
    const treeColumns = [
      { key: "service", label: "Service", width: 220 },
      { key: "owner", label: "Owner", width: 180 },
    ] as const
    const treeRowModel = createClientRowModel({
      rows: treeRows.value,
      initialTreeData: {
        mode: "path",
        getDataPath(row) {
          return row.path
        },
        expandedByDefault: true,
      },
    })
    let grid: ReturnType<typeof useAffinoDataGrid<typeof treeRows.value[number]>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridTreeSelectionPolicyHost",
      setup() {
        grid = useAffinoDataGrid({
          rows: treeRows,
          columns: treeColumns,
          rowModel: treeRowModel,
          features: {
            tree: {
              enabled: true,
              groupSelectsChildren: true,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const firstGroup = grid!.api.getRow(0)
    expect(firstGroup?.kind).toBe("group")
    const selected = grid!.cellSelection.setCellByKey(String(firstGroup?.rowId ?? ""), "service")
    expect(selected).toBe(true)
    expect(grid!.cellSelection.range.value?.startRow).toBe(0)
    expect(grid!.cellSelection.range.value?.endRow ?? 0).toBeGreaterThan(0)

    grid!.features.tree.groupSelectsChildren.value = false
    const reselection = grid!.cellSelection.setCellByKey(String(firstGroup?.rowId ?? ""), "service")
    expect(reselection).toBe(true)
    expect(grid!.cellSelection.range.value).toMatchObject({
      startRow: 0,
      endRow: 0,
    })

    wrapper.unmount()
  })

  it("boots runtime and exposes sort + selection sugar", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
    ])

    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          initialSortState: [{ key: "service", direction: "asc" }],
          features: {
            selection: true,
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    expect(grid).not.toBeNull()
    expect(grid!.api.lifecycle.state).toBe("started")
    expect(grid!.rowModel.getSnapshot().sortModel).toEqual([{ key: "service", direction: "asc" }])

    grid!.toggleColumnSort("service")
    await flushTasks()
    expect(grid!.rowModel.getSnapshot().sortModel).toEqual([{ key: "service", direction: "desc" }])

    grid!.features.selection.setSelectedByKey("r1", true)
    expect(grid!.features.selection.isSelectedByKey("r1")).toBe(true)
    expect(grid!.features.selection.selectedCount.value).toBe(1)

    rows.value = [{ rowId: "r2", service: "billing-api", owner: "Payments" }]
    await flushTasks()
    expect(grid!.features.selection.isSelectedByKey("r1")).toBe(false)
    expect(grid!.features.selection.selectedCount.value).toBe(0)

    wrapper.unmount()
  })

  it("supports clipboard + editing sugar flow", async () => {
    const onCommit = vi.fn()
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridClipboardEditingHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows: [{ rowId: "r1", service: "edge-gateway", owner: "NOC" }],
          columns: COLUMNS,
          features: {
            clipboard: {
              enabled: true,
              useSystemClipboard: false,
            },
            editing: {
              mode: "cell",
              enum: true,
              onCommit,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const copied = await grid!.features.clipboard.copyText("alpha")
    expect(copied).toBe(true)
    expect(grid!.features.clipboard.lastCopiedText.value).toBe("alpha")
    expect(await grid!.features.clipboard.readText()).toBe("alpha")

    expect(grid!.features.editing.beginEdit({
      rowKey: "r1",
      columnKey: "owner",
      draft: "qa-owner",
    })).toBe(true)
    expect(grid!.features.editing.activeSession.value?.columnKey).toBe("owner")
    expect(grid!.features.editing.updateDraft("qa-owner-updated")).toBe(true)

    await expect(grid!.features.editing.commitEdit()).resolves.toBe(true)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(grid!.features.editing.activeSession.value).toBeNull()

    wrapper.unmount()
  })

  it("provides bindings helpers for header sort, row selection, and inline editing", async () => {
    const onCommit = vi.fn()
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
    ])
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridBindingsHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          features: {
            selection: true,
            editing: {
              enabled: true,
              onCommit,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const header = grid!.bindings.headerSort("service")
    expect(header["aria-sort"]).toBe("none")
    header.onClick()
    await flushTasks()
    expect(grid!.sortState.value).toEqual([{ key: "service", direction: "asc" }])
    grid!.bindings.headerSort("service").onKeydown({
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent)
    await flushTasks()
    expect(grid!.sortState.value).toEqual([{ key: "service", direction: "desc" }])

    expect(rows.value[0]).toBeDefined()
    const firstRow = rows.value[0]!
    const rowBinding = grid!.bindings.rowSelection(firstRow, 0)
    rowBinding.onClick()
    expect(grid!.features.selection.selectedCount.value).toBe(1)
    expect(grid!.features.selection.selectedRowKeys.value).toEqual(["r1"])

    const editableCell = grid!.bindings.editableCell({
      row: firstRow,
      rowIndex: 0,
      columnKey: "owner",
      value: "NOC",
    })
    editableCell.onDblclick()
    expect(grid!.bindings.isCellEditing("r1", "owner")).toBe(true)

    const editor = grid!.bindings.inlineEditor({
      rowKey: "r1",
      columnKey: "owner",
    })
    editor.onInput({
      target: { value: "qa-owner" },
    } as unknown as Event)
    expect(grid!.features.editing.activeSession.value?.draft).toBe("qa-owner")
    editor.onKeydown({
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent)
    await flushTasks()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(grid!.features.editing.activeSession.value).toBeNull()

    wrapper.unmount()
  })

  it("routes sugar actions and context-menu actions without custom routers", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
    ])
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridActionsHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          features: {
            selection: true,
            clipboard: {
              enabled: true,
              useSystemClipboard: false,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    grid!.features.selection.setSelectedByKey("r1", true)
    await expect(grid!.actions.copySelectedRows()).resolves.toBe(true)
    expect(grid!.features.clipboard.lastCopiedText.value).toContain("edge-gateway")

    await expect(grid!.actions.runAction("cut")).resolves.toMatchObject({
      ok: true,
      affected: 1,
    })
    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]).toBeDefined()
    const firstRow = rows.value[0]!
    expect(firstRow.rowId).toBe("r2")

    await expect(grid!.actions.runAction("paste")).resolves.toMatchObject({
      ok: false,
      affected: 0,
    })
    expect(rows.value).toHaveLength(1)

    await expect(grid!.actions.runAction("sort-asc", { columnKey: "service" })).resolves.toMatchObject({
      ok: true,
    })
    expect(grid!.sortState.value).toEqual([{ key: "service", direction: "asc" }])

    grid!.bindings.headerCell("owner").onContextmenu({
      preventDefault: vi.fn(),
      clientX: 120,
      clientY: 80,
    } as unknown as MouseEvent)
    await flushTasks()
    const captureResult = vi.fn()
    grid!.bindings.contextMenuAction("sort-desc", { onResult: captureResult }).onClick()
    await flushTasks()
    expect(captureResult).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      affected: 1,
    }))
    expect(grid!.sortState.value).toEqual([{ key: "owner", direction: "desc" }])
    expect(grid!.contextMenu.state.value.visible).toBe(false)

    const toolbarResult = vi.fn()
    grid!.bindings.actionButton("clear-selection", { onResult: toolbarResult }).onClick()
    await flushTasks()
    expect(toolbarResult).toHaveBeenCalled()

    expect(rows.value[0]).toBeDefined()
    const contextMenuRow = rows.value[0]!
    grid!.bindings.dataCell({
      row: contextMenuRow,
      rowIndex: 0,
      columnKey: "owner",
      value: contextMenuRow.owner,
    }).onContextmenu({
      preventDefault: vi.fn(),
      clientX: 32,
      clientY: 16,
    } as unknown as MouseEvent)
    expect(grid!.contextMenu.state.value.zone).toBe("cell")
    expect(grid!.contextMenu.state.value.columnKey).toBe("owner")

    wrapper.unmount()
  })

  it("exposes advanced filtering helpers for typed composition and set merge flows", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
    ])
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridAdvancedFilterHelpersHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          features: {
            filtering: {
              enabled: true,
              initialFilterModel: {
                columnFilters: {},
                advancedFilters: {},
              },
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const firstExpression = grid!.features.filtering.helpers.setText("service", {
      operator: "contains",
      value: "api",
      mergeMode: "replace",
    })
    expect(firstExpression?.kind).toBe("condition")
    expect(grid!.features.filtering.model.value?.advancedExpression).toEqual(firstExpression)

    const secondExpression = grid!.features.filtering.helpers.setNumber("latencyMs", {
      operator: ">",
      value: 250,
      mergeMode: "merge-and",
    })
    expect(secondExpression?.kind).toBe("group")

    const thirdExpression = grid!.features.filtering.helpers.setSet("owner", ["NOC"], {
      valueMode: "replace",
      mergeMode: "merge-and",
    })
    expect(thirdExpression).not.toBeNull()

    const fourthExpression = grid!.features.filtering.helpers.setSet("owner", ["Payments"], {
      valueMode: "append",
      mergeMode: "merge-and",
    })
    expect(fourthExpression).not.toBeNull()

    const removeOwnerExpression = grid!.features.filtering.helpers.setSet("owner", ["NOC", "Payments"], {
      valueMode: "remove",
      mergeMode: "merge-and",
    })
    expect(removeOwnerExpression).not.toBeNull()

    const clearedOwner = grid!.features.filtering.helpers.clearByKey("owner")
    expect(clearedOwner).not.toBeNull()

    wrapper.unmount()
  })

  it("supports cell selection and cell-range clipboard/fill/move sugar flows", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
      { rowId: "r3", service: "search-api", owner: "Ops" },
    ])
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridCellRangeHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          features: {
            selection: true,
            clipboard: {
              enabled: true,
              useSystemClipboard: false,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    expect(grid!.cellSelection.setCellByKey("r1", "owner")).toBe(true)
    expect(grid!.cellSelection.activeCell.value?.rowKey).toBe("r1")
    expect(grid!.cellSelection.activeCell.value?.columnKey).toBe("owner")
    expect(grid!.cellSelection.isCellSelected(0, 1)).toBe(true)

    expect(grid!.cellSelection.setCellByKey("r2", "owner", { extend: true })).toBe(true)
    expect(grid!.cellSelection.range.value).toMatchObject({
      startRow: 0,
      endRow: 1,
      startColumn: 1,
      endColumn: 1,
    })

    await expect(grid!.cellRange.copy("context-menu")).resolves.toBe(true)
    expect(grid!.cellRange.copiedRange.value).toMatchObject({
      startRow: 0,
      endRow: 1,
      startColumn: 1,
      endColumn: 1,
    })

    expect(grid!.cellSelection.setCellByKey("r1", "owner")).toBe(true)
    await expect(grid!.cellRange.clear("context-menu")).resolves.toBe(true)
    expect(rows.value[0]?.owner).toBeNull()

    await expect(grid!.cellRange.paste("context-menu")).resolves.toBe(true)
    expect(rows.value[0]?.owner).toBe("NOC")

    grid!.cellRange.setFillPreviewRange({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    })
    expect(grid!.cellRange.fillPreviewRange.value).toMatchObject({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    })
    grid!.cellRange.applyFillPreview()
    expect(rows.value[1]?.owner).toBe("NOC")

    grid!.cellRange.setRangeMovePreviewRange({
      startRow: 2,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    })
    expect(grid!.cellRange.rangeMovePreviewRange.value).toMatchObject({
      startRow: 2,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    })
    expect(grid!.cellRange.applyRangeMove()).toBe(true)

    wrapper.unmount()
  })

  it("emits stable tree events for group-by and expansion updates", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "NOC" },
      { rowId: "r3", service: "search-api", owner: "Ops" },
    ])
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridTreeEventsHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          features: {
            tree: {
              enabled: true,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const captured: string[] = []
    const unsubscribe = grid!.events.on("*", event => {
      if (event.name === "groupByChange" || event.name === "groupExpansionChange") {
        captured.push(event.name)
      }
    })
    grid!.events.clear()

    grid!.features.tree.setGroupBy({
      fields: ["owner"],
      expandedByDefault: false,
    })
    await flushTasks()

    grid!.features.tree.expandAll()
    await flushTasks()

    expect(captured).toContain("groupByChange")
    expect(captured).toContain("groupExpansionChange")
    expect(grid!.events.log.value.some(event => event.name === "groupByChange")).toBe(true)
    expect(grid!.events.log.value.some(event => event.name === "groupExpansionChange")).toBe(true)

    unsubscribe()
    wrapper.unmount()
  })
})
