import { describe, expect, it, vi } from "vitest"
import { initializeExamplePicker } from "./examplePicker"

describe("sandbox example picker", () => {
  it("navigates to the selected example", () => {
    document.body.innerHTML = `
      <select data-example-picker>
        <option value="/">Overview</option>
        <option value="/examples/sorting/">Sorting</option>
      </select>
    `
    const navigate = vi.fn()
    const picker = document.querySelector<HTMLSelectElement>("[data-example-picker]")!

    initializeExamplePicker(document, navigate)
    picker.value = "/examples/sorting/"
    picker.dispatchEvent(new Event("change"))

    expect(navigate).toHaveBeenCalledWith("/examples/sorting/")
  })

  it("adds the row-selection example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(document.querySelector<HTMLSelectElement>("[data-example-picker]")?.options[1]?.value)
      .toBe("/examples/row-selection/")
  })

  it("adds pinned-bottom rows to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/pinned-bottom/")?.textContent)
      .toBe("41 · Pinned bottom rows")
  })

  it("adds the Canvas chrome example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/canvas-chrome/")?.textContent)
      .toBe("42 · Canvas chrome")
  })

  it("adds the XLSX export example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())

    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/xlsx-export/")?.textContent)
      .toBe("43 · XLSX export")
  })

  it("adds the Gantt view to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())

    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/gantt/")?.textContent)
      .toBe("44 · Gantt view")
  })

  it("adds the history example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(document.querySelector<HTMLSelectElement>("[data-example-picker]")?.options[2]?.value)
      .toBe("/examples/history/")
  })

  it("adds the formula-fields example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(document.querySelector<HTMLSelectElement>("[data-example-picker]")?.options[3]?.value)
      .toBe("/examples/formulas/")
  })

  it("adds the select-editing example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(document.querySelector<HTMLSelectElement>("[data-example-picker]")?.options[4]?.value)
      .toBe("/examples/select-editing/")
  })

  it("adds the checkbox-cells example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(document.querySelector<HTMLSelectElement>("[data-example-picker]")?.options[5]?.value)
      .toBe("/examples/checkbox-cells/")
  })

  it("adds the date-editing example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/date-editing/")?.textContent)
      .toBe("24 · Date editing")
  })

  it("adds the numeric-editing example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/numeric-editing/")?.textContent)
      .toBe("25 · Numeric editing")
  })

  it("adds the edit-validation example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/edit-validation/")?.textContent)
      .toBe("26 · Edit validation")
  })

  it("adds the cell-renderer example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/cell-renderer/")?.textContent)
      .toBe("27 · Cell renderer")
  })

  it("adds the quick-filter example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/quick-filter/")?.textContent)
      .toBe("28 · Quick filter")
  })

  it("adds the condition-filter example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/condition-filter/")?.textContent)
      .toBe("29 · Condition filter")
  })

  it("adds the advanced-filter example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/advanced-filter/")?.textContent)
      .toBe("30 · Advanced filter")
  })

  it("adds the histogram example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/histogram/")?.textContent)
      .toBe("31 · Value histogram")
  })

  it("adds the fill-handle example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/fill-handle/")?.textContent)
      .toBe("32 · Fill handle")
  })

  it("adds the cell styles example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/cell-styles/")?.textContent)
      .toBe("34 · Cell styles")
  })

  it("adds the selection summary example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/selection-summary/")?.textContent)
      .toBe("35 · Selection summary")
  })

  it("adds the pivot example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/pivot/")?.textContent)
      .toBe("36 · Pivot view")
  })

  it("adds the column-groups example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    const picker = document.querySelector<HTMLSelectElement>("[data-example-picker]")!

    expect(Array.from(picker.options)
      .find(option => option.value === "/examples/column-groups/")?.textContent)
      .toBe("37 · Column groups")
  })

  it("adds the aggregation example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/aggregation/")?.textContent)
      .toBe("38 · Aggregation")
  })

  it("adds the combobox cell example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/combobox-cell/")?.textContent)
      .toBe("39 · ComboBox cell")
  })

  it("adds the server row-model example to existing pickers", () => {
    document.body.innerHTML = `<select data-example-picker><option value="/">Overview</option></select>`
    initializeExamplePicker(document, vi.fn())
    expect(Array.from(document.querySelector<HTMLSelectElement>("[data-example-picker]")!.options)
      .find(option => option.value === "/examples/server-row-model/")?.textContent)
      .toBe("40 · Server row model")
  })

})
