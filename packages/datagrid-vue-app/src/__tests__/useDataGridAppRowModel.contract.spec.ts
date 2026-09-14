import { defineComponent, nextTick, ref } from "vue"
import { describe, expect, it } from "vitest"
import { mount } from "@vue/test-utils"
import { useDataGridAppRowModel } from "../useDataGridAppRowModel"

async function flushWatchers(): Promise<void> {
  await nextTick()
  await nextTick()
}

describe("useDataGridAppRowModel options contract", () => {
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
})
