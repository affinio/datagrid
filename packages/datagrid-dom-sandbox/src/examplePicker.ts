export function initializeExamplePicker(
  document: Document,
  navigate: (destination: string) => void = (destination) => document.defaultView?.location.assign(destination),
): void {
  const picker = document.querySelector<HTMLSelectElement>("[data-example-picker]")
  if (!picker) return

  if (!Array.from(picker.options).some(option => option.value === "/examples/row-selection/")) {
    const option = document.createElement("option")
    option.value = "/examples/row-selection/"
    option.textContent = "19 · Row selection"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/history/")) {
    const option = document.createElement("option")
    option.value = "/examples/history/"
    option.textContent = "20 · Undo and redo"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/formulas/")) {
    const option = document.createElement("option")
    option.value = "/examples/formulas/"
    option.textContent = "21 · Formula fields"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/select-editing/")) {
    const option = document.createElement("option")
    option.value = "/examples/select-editing/"
    option.textContent = "22 · Select editing"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/checkbox-cells/")) {
    const option = document.createElement("option")
    option.value = "/examples/checkbox-cells/"
    option.textContent = "23 · Checkbox cells"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/date-editing/")) {
    const option = document.createElement("option")
    option.value = "/examples/date-editing/"
    option.textContent = "24 · Date editing"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/numeric-editing/")) {
    const option = document.createElement("option")
    option.value = "/examples/numeric-editing/"
    option.textContent = "25 · Numeric editing"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/edit-validation/")) {
    const option = document.createElement("option")
    option.value = "/examples/edit-validation/"
    option.textContent = "26 · Edit validation"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/cell-renderer/")) {
    const option = document.createElement("option")
    option.value = "/examples/cell-renderer/"
    option.textContent = "27 · Cell renderer"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/quick-filter/")) {
    const option = document.createElement("option")
    option.value = "/examples/quick-filter/"
    option.textContent = "28 · Quick filter"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/condition-filter/")) {
    const option = document.createElement("option")
    option.value = "/examples/condition-filter/"
    option.textContent = "29 · Condition filter"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/advanced-filter/")) {
    const option = document.createElement("option")
    option.value = "/examples/advanced-filter/"
    option.textContent = "30 · Advanced filter"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/histogram/")) {
    const option = document.createElement("option")
    option.value = "/examples/histogram/"
    option.textContent = "31 · Value histogram"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/fill-handle/")) {
    const option = document.createElement("option")
    option.value = "/examples/fill-handle/"
    option.textContent = "32 · Fill handle"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/range-move/")) {
    const option = document.createElement("option")
    option.value = "/examples/range-move/"
    option.textContent = "33 · Move selected range"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/cell-styles/")) {
    const option = document.createElement("option")
    option.value = "/examples/cell-styles/"
    option.textContent = "34 · Cell styles"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/selection-summary/")) {
    const option = document.createElement("option")
    option.value = "/examples/selection-summary/"
    option.textContent = "35 · Selection summary"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/pivot/")) {
    const option = document.createElement("option")
    option.value = "/examples/pivot/"
    option.textContent = "36 · Pivot view"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/column-groups/")) {
    const option = document.createElement("option")
    option.value = "/examples/column-groups/"
    option.textContent = "37 · Column groups"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/aggregation/")) {
    const option = document.createElement("option")
    option.value = "/examples/aggregation/"
    option.textContent = "38 · Aggregation"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/combobox-cell/")) {
    const option = document.createElement("option")
    option.value = "/examples/combobox-cell/"
    option.textContent = "39 · ComboBox cell"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/server-row-model/")) {
    const option = document.createElement("option")
    option.value = "/examples/server-row-model/"
    option.textContent = "40 · Server row model"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/pinned-bottom/")) {
    const option = document.createElement("option")
    option.value = "/examples/pinned-bottom/"
    option.textContent = "41 · Pinned bottom rows"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/canvas-chrome/")) {
    const option = document.createElement("option")
    option.value = "/examples/canvas-chrome/"
    option.textContent = "42 · Canvas chrome"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/xlsx-export/")) {
    const option = document.createElement("option")
    option.value = "/examples/xlsx-export/"
    option.textContent = "43 · XLSX export"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/gantt/")) {
    const option = document.createElement("option")
    option.value = "/examples/gantt/"
    option.textContent = "44 · Gantt view"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/empty-state/")) {
    const option = document.createElement("option")
    option.value = "/examples/empty-state/"
    option.textContent = "45 · Empty state"
    picker.append(option)
  }

  if (!Array.from(picker.options).some(option => option.value === "/examples/shell/")) {
    const option = document.createElement("option")
    option.value = "/examples/shell/"
    option.textContent = "46 · DOM shell showcase"
    picker.append(option)
  }

  picker.addEventListener("change", () => {
    const destination = picker.value
    if (destination) navigate(destination)
  })
}

initializeExamplePicker(document)
