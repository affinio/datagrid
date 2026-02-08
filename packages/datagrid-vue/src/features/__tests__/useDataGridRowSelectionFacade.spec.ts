import { computed, nextTick, ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridRowSelectionFacade } from "../useDataGridRowSelectionFacade"

interface DemoRow {
  id: number
  label: string
}

describe("useDataGridRowSelectionFacade", () => {
  it("clears selection when feature is disabled", async () => {
    const rows = ref<DemoRow[]>([
      { id: 1, label: "A" },
      { id: 2, label: "B" },
    ])
    const model = ref<(DemoRow | number)[] | undefined>(undefined)
    const controlled = ref(false)
    const enabled = ref(true)
    const updates: DemoRow[][] = []

    const facade = useDataGridRowSelectionFacade<DemoRow>({
      rows: computed(() => rows.value),
      modelValue: computed(() => model.value),
      controlled: computed(() => controlled.value),
      enabled: computed(() => enabled.value),
      rowKey: row => row.id,
      isServerPlaceholderRow: () => false,
      selectedRowClass: computed(() => "is-selected"),
      emitUpdateSelected: selected => {
        updates.push(selected)
      },
    })

    facade.rowSelection.selectAll()
    expect(facade.selectedRowCount.value).toBe(2)

    enabled.value = false
    await nextTick()

    expect(facade.selectedRowCount.value).toBe(0)
    expect(updates.at(-1)).toEqual([])
  })

  it("maintains checkbox indeterminate state and row class helpers", async () => {
    const rows = ref<DemoRow[]>([
      { id: 10, label: "Row 10" },
      { id: 20, label: "Row 20" },
    ])
    const facade = useDataGridRowSelectionFacade<DemoRow>({
      rows: computed(() => rows.value),
      modelValue: computed(() => undefined),
      controlled: computed(() => false),
      enabled: computed(() => true),
      rowKey: row => row.id,
      isServerPlaceholderRow: () => false,
      selectedRowClass: computed(() => "row-selected"),
      emitUpdateSelected: () => {},
    })

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    facade.setHeaderSelectionCheckboxRef(checkbox)

    facade.handleRowCheckboxToggle(rows.value[0]!)
    await nextTick()

    expect(checkbox.indeterminate).toBe(true)
    expect(facade.isCheckboxRowSelected(rows.value[0]!)).toBe(true)
    expect(facade.rowGridClass(rows.value[0]!)).toBe("row-selected")
    expect(facade.rowGridClass(rows.value[1]!)).toBeUndefined()
  })
})
