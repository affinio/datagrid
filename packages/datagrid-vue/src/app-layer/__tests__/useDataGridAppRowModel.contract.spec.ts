import { defineComponent, nextTick, ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { useDataGridAppRowModel } from "../useDataGridAppRowModel"
import type { AdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"

async function flushWatchers(): Promise<void> {
  await nextTick()
  await nextTick()
}

describe("useDataGridAppRowModel options contract", () => {
  it("patches stable immutable row updates only when opt-in mode is enabled", async () => {
    const rows = ref<readonly unknown[]>([{ id: 1, value: "before" }, { id: 2, value: "same" }])
    const rowModel = ref(undefined)
    const clientRowModelOptions = ref({ resolveRowId: (row: unknown) => (row as { id: number }).id })
    let result: ReturnType<typeof useDataGridAppRowModel> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        result = useDataGridAppRowModel({ rows, rowModel, clientRowModelOptions, rowsUpdateMode: "patch" })
        return {}
      },
      render: () => null,
    }))
    await flushWatchers()
    const initialModel = result?.resolvedRowModel.value
    const unchangedRowNode = initialModel?.getRow(1)

    rows.value = [{ id: 1, value: "after" }, { id: 2, value: "same" }]
    await flushWatchers()

    expect(result?.resolvedRowModel.value).toBe(initialModel)
    expect(result?.dataGridInstanceKey.value).toBe(0)
    expect((result?.resolvedRowModel.value.getRow(0)?.row as { value?: string }).value).toBe("after")
    expect(result?.resolvedRowModel.value.getRow(1)).toBe(unchangedRowNode)

    for (let update = 0; update < 10; update += 1) {
      rows.value = [{ id: 1, value: `after-${update}` }, { id: 2, value: "same" }]
      await flushWatchers()
      expect(result?.resolvedRowModel.value).toBe(initialModel)
      expect(result?.dataGridInstanceKey.value).toBe(0)
      expect(result?.resolvedRowModel.value.getRow(1)).toBe(unchangedRowNode)
    }

    rows.value = [{ id: 2, value: "same" }, { id: 1, value: "after" }]
    await flushWatchers()
    expect(result?.resolvedRowModel.value.getRow(0)?.rowId).toBe(2)

    wrapper.unmount()
  })

  it("keeps the owned model for equivalent inline options and recreates for semantic changes", async () => {
    const rows = ref<readonly unknown[]>([{ id: 1 }])
    const rowModel = ref(undefined)
    const resolveRowId = (row: unknown) => (row as { id: number }).id
    const clientRowModelOptions = ref({ resolveRowId })
    let result: ReturnType<typeof useDataGridAppRowModel> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        result = useDataGridAppRowModel({ rows, rowModel, clientRowModelOptions })
        return {}
      },
      render: () => null,
    }))
    await flushWatchers()

    const initialModel = result?.resolvedRowModel.value
    clientRowModelOptions.value = { resolveRowId }
    await flushWatchers()
    expect(result?.resolvedRowModel.value).toBe(initialModel)
    expect(result?.dataGridInstanceKey.value).toBe(0)

    clientRowModelOptions.value = { resolveRowId, initialSortModel: [{ field: "id", direction: "desc" }] }
    await flushWatchers()
    expect(result?.resolvedRowModel.value).not.toBe(initialModel)
    expect(result?.dataGridInstanceKey.value).toBe(1)

    wrapper.unmount()
  })

  it("passes projection recompute policy to value patches while structural row changes still replace rows", async () => {
    const rows = ref<readonly unknown[]>([{ id: 1, value: "before" }, { id: 2, value: "same" }])
    const rowModel = ref(undefined)
    const clientRowModelOptions = ref({ resolveRowId: (row: unknown) => (row as { id: number }).id })
    const shouldAutoReapplyProjection = vi.fn(() => false)
    let result: ReturnType<typeof useDataGridAppRowModel> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        result = useDataGridAppRowModel({
          rows,
          rowModel,
          clientRowModelOptions,
          rowsUpdateMode: "patch",
          shouldAutoReapplyProjection,
        })
        return {}
      },
      render: () => null,
    }))
    await flushWatchers()

    const model = result!.resolvedRowModel.value as AdvancedClientRowModel<unknown>
    const patchRows = vi.spyOn(model, "patchRows")
    rows.value = [{ id: 1, value: "after" }, { id: 2, value: "same" }]
    await flushWatchers()

    expect(shouldAutoReapplyProjection).toHaveBeenCalledOnce()
    expect(patchRows).toHaveBeenCalledWith(
      [{ rowId: 1, data: { id: 1, value: "after" } }],
      { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
    )

    shouldAutoReapplyProjection.mockReturnValue(true)
    rows.value = [{ id: 1, value: "mutable" }, { id: 2, value: "same" }]
    await flushWatchers()
    expect(patchRows).toHaveBeenLastCalledWith(
      [{ rowId: 1, data: { id: 1, value: "mutable" } }],
      { recomputeSort: true, recomputeFilter: true, recomputeGroup: true },
    )

    rows.value = [{ id: 1, value: "mutable" }, { id: 2, value: "same" }, { id: 3, value: "added" }]
    await flushWatchers()
    expect(result?.resolvedRowModel.value.getRow(2)?.rowId).toBe(3)
    rows.value = [{ id: 1, value: "mutable" }, { id: 2, value: "same" }]
    await flushWatchers()
    expect(result?.resolvedRowModel.value.getRow(2) ?? null).toBeNull()
    expect(shouldAutoReapplyProjection).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
