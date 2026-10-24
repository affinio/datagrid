export interface FilterableComboboxOption {
  label: string
  value: unknown
}

export interface FilterableComboboxEditorHandle {
  readonly input: HTMLInputElement
  readonly loading: boolean
  resolveValue(): unknown
  dispose(): void
}

export type FilterableComboboxCommitTarget = "next" | "previous" | "stay" | -1 | 1

export function createFilterableComboboxEditor(options: {
  cell: HTMLElement
  grid: HTMLElement
  value: unknown
  source: unknown
  commit: (value: unknown, target: FilterableComboboxCommitTarget) => void
  cancel: () => void
}): FilterableComboboxEditorHandle {
  const document = options.grid.ownerDocument
  const view = document.defaultView
  const input = document.createElement("input")
  input.type = "text"
  input.className = "affino-grid-dom__editor affino-grid-dom__editor--combobox"
  input.setAttribute("role", "combobox")
  input.setAttribute("aria-autocomplete", "list")
  input.setAttribute("aria-expanded", "true")
  input.setAttribute("aria-label", "Choose a value")
  const listId = `affino-grid-dom-combobox-${++comboboxSequence}`
  input.setAttribute("aria-controls", listId)

  const panel = document.createElement("div")
  panel.id = listId
  panel.className = "affino-grid-dom__combobox-panel"
  panel.setAttribute("role", "listbox")
  panel.setAttribute("aria-label", "Available values")
  const optionSource = normalizeOptionSource(options.source)
  let displayed = [...optionSource]
  let activeIndex = findSelectedIndex(displayed, options.value)
  let selectedValue = options.value
  let filter = ""
  let isLoading = false
  let disposed = false
  let requestVersion = 0
  let positionFrame: number | null = null

  input.value = optionSource.find(option => Object.is(option.value, options.value))?.label
    ?? (options.value == null ? "" : String(options.value))
  const popupView = view
  if (popupView) {
    const computed = popupView.getComputedStyle(options.grid)
    for (let index = 0; index < computed.length; index += 1) {
      const property = computed.item(index)
      if (property.startsWith("--datagrid-")) {
        const value = computed.getPropertyValue(property)
        if (value) panel.style.setProperty(property, value)
      }
    }
  }

  const updatePosition = (): void => {
    if (disposed) return
    const rect = input.getBoundingClientRect()
    const width = Math.max(rect.width, 160)
    const height = Math.min(panel.scrollHeight || 220, 260)
    const win = document.defaultView
    if (!win) return
    const placeAbove = win.innerHeight - rect.bottom < Math.min(height, 180) && rect.top > height + 12
    panel.style.position = "fixed"
    panel.style.top = `${Math.max(8, placeAbove ? rect.top - height + 1 : Math.min(win.innerHeight - height - 8, rect.bottom - 1))}px`
    panel.style.left = `${Math.min(Math.max(8, rect.left), Math.max(8, win.innerWidth - width - 8))}px`
    panel.style.width = `${width}px`
  }
  const schedulePosition = (): void => {
    if (!view || positionFrame != null) return
    positionFrame = view.requestAnimationFrame(() => {
      positionFrame = null
      updatePosition()
    })
  }
  const visibleOptions = (): FilterableComboboxOption[] => filterOptions(optionSource, filter)
  const updateActiveOption = (): void => {
    const active = displayed[activeIndex]
    if (active) input.setAttribute("aria-activedescendant", `${listId}-option-${activeIndex}`)
    else input.removeAttribute("aria-activedescendant")
  }
  const renderOptions = (): void => {
    panel.replaceChildren()
    if (isLoading) {
      const loading = document.createElement("div")
      loading.className = "affino-grid-dom__combobox-empty"
      loading.textContent = "Loading options…"
      panel.append(loading)
      updatePosition()
      return
    }
    if (displayed.length === 0) {
      const empty = document.createElement("div")
      empty.className = "affino-grid-dom__combobox-empty"
      empty.textContent = "No matching options"
      panel.append(empty)
      updateActiveOption()
      updatePosition()
      return
    }
    displayed.forEach((option, index) => {
      const button = document.createElement("button")
      button.type = "button"
      button.id = `${listId}-option-${index}`
      button.className = "affino-grid-dom__combobox-option"
      if (index === activeIndex) button.classList.add("affino-grid-dom__combobox-option--active")
      if (Object.is(option.value, selectedValue)) button.classList.add("affino-grid-dom__combobox-option--selected")
      button.setAttribute("role", "option")
      button.setAttribute("aria-selected", String(Object.is(option.value, selectedValue)))
      button.dataset.optionIndex = String(index)
      const label = document.createElement("span")
      label.textContent = option.label
      button.append(label)
      if (Object.is(option.value, selectedValue)) {
        const check = document.createElement("span")
        check.className = "affino-grid-dom__combobox-check"
        check.setAttribute("aria-hidden", "true")
        button.append(check)
      }
      button.addEventListener("mousemove", () => {
        activeIndex = index
        updateActiveOption()
        panel.querySelectorAll<HTMLElement>("[data-option-index]").forEach((optionElement, optionIndex) => {
          optionElement.classList.toggle("affino-grid-dom__combobox-option--active", optionIndex === activeIndex)
        })
      })
      button.addEventListener("mousedown", event => event.preventDefault())
      button.addEventListener("click", () => choose(option, "stay"))
      panel.append(button)
    })
    updateActiveOption()
    updatePosition()
  }
  const choose = (option: FilterableComboboxOption, target: FilterableComboboxCommitTarget): void => {
    selectedValue = option.value
    options.commit(selectedValue, target)
  }
  const loadAsyncOptions = async (): Promise<void> => {
    if (!isPromiseLike(options.source)) return
    const request = ++requestVersion
    isLoading = true
    renderOptions()
    try {
      const resolved = await options.source
      if (disposed || request !== requestVersion) return
      optionSource.splice(0, optionSource.length, ...normalizeOptionSource(resolved))
      displayed = visibleOptions()
      activeIndex = findSelectedIndex(displayed, selectedValue)
      input.removeAttribute("aria-invalid")
    } catch {
      if (disposed || request !== requestVersion) return
      optionSource.length = 0
      displayed = []
      activeIndex = -1
      input.setAttribute("aria-invalid", "true")
      const error = document.createElement("div")
      error.className = "affino-grid-dom__combobox-empty"
      error.textContent = "Options could not be loaded"
      panel.replaceChildren(error)
    } finally {
      if (!disposed && request === requestVersion) {
        isLoading = false
        renderOptions()
      }
    }
  }
  const onInput = (): void => {
    filter = input.value
    displayed = visibleOptions()
    activeIndex = displayed.length > 0 ? 0 : -1
    renderOptions()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.key === "Process" || event.keyCode === 229) return
    event.stopPropagation()
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (displayed.length > 0) {
        activeIndex = activeIndex < 0
          ? (event.key === "ArrowDown" ? 0 : displayed.length - 1)
          : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + displayed.length) % displayed.length
        renderOptions()
        panel.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" })
      }
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      activeIndex = displayed.length === 0 ? -1 : event.key === "Home" ? 0 : displayed.length - 1
      renderOptions()
      return
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      event.stopPropagation()
      const target = event.key === "Tab"
        ? (event.shiftKey ? "previous" : "next")
        : (event.shiftKey ? -1 : 1)
      if (!isLoading && !input.hasAttribute("aria-invalid") && displayed[activeIndex]) {
        choose(displayed[activeIndex]!, target)
      } else if (!isLoading && !input.hasAttribute("aria-invalid")) {
        options.commit(selectedValue, target)
      }
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      options.cancel()
    }
  }
  const stopGridEvent = (event: Event): void => event.stopPropagation()
  const onViewportChange = (): void => schedulePosition()
  input.addEventListener("input", onInput)
  input.addEventListener("keydown", onKeyDown)
  input.addEventListener("mousedown", stopGridEvent)
  input.addEventListener("click", stopGridEvent)
  input.addEventListener("contextmenu", stopGridEvent)
  view?.addEventListener("resize", onViewportChange)
  view?.addEventListener("scroll", onViewportChange, { capture: true, passive: true })
  options.cell.replaceChildren(input)
  options.cell.classList.add("affino-grid-dom__cell--editing")
  document.body.append(panel)
  renderOptions()
  void loadAsyncOptions()
  input.focus()
  input.select()

  return {
    input,
    get loading() { return isLoading },
    resolveValue: () => {
      if (!filter) return selectedValue
      const normalized = input.value.trim().toLocaleLowerCase()
      const exact = displayed.find(option => option.label.trim().toLocaleLowerCase() === normalized
        || String(option.value).trim().toLocaleLowerCase() === normalized)
      return exact?.value ?? displayed[activeIndex]?.value ?? selectedValue
    },
    dispose() {
      if (disposed) return
      disposed = true
      requestVersion += 1
      input.removeEventListener("input", onInput)
      input.removeEventListener("keydown", onKeyDown)
      input.removeEventListener("mousedown", stopGridEvent)
      input.removeEventListener("click", stopGridEvent)
      input.removeEventListener("contextmenu", stopGridEvent)
      view?.removeEventListener("resize", onViewportChange)
      view?.removeEventListener("scroll", onViewportChange, { capture: true })
      if (positionFrame != null) view?.cancelAnimationFrame(positionFrame)
      options.cell.classList.remove("affino-grid-dom__cell--editing")
      panel.remove()
    },
  }
}

function normalizeOptionSource(source: unknown): FilterableComboboxOption[] {
  if (!Array.isArray(source)) return []
  return source.map(option => {
    if (typeof option === "object" && option !== null && "value" in option) {
      const entry = option as { value: unknown; label?: unknown }
      return { value: entry.value, label: entry.label == null ? String(entry.value ?? "") : String(entry.label) }
    }
    return { value: option, label: String(option ?? "") }
  })
}

function isPromiseLike(value: unknown): value is PromiseLike<readonly unknown[]> {
  return typeof value === "object" && value !== null && "then" in value
    && typeof (value as { then?: unknown }).then === "function"
}

function findSelectedIndex(options: readonly FilterableComboboxOption[], value: unknown): number {
  const index = options.findIndex(option => Object.is(option.value, value))
  return index >= 0 ? index : options.length > 0 ? 0 : -1
}

function filterOptions(options: readonly FilterableComboboxOption[], query: string): FilterableComboboxOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return [...options]
  return options
    .map((option, index) => ({ option, index, score: optionScore(option, normalizedQuery) }))
    .filter(item => item.score < 8)
    .sort((left, right) => left.score - right.score
      || left.option.label.length - right.option.label.length
      || left.index - right.index)
    .map(item => item.option)
}

function optionScore(option: FilterableComboboxOption, query: string): number {
  const label = option.label.trim().toLocaleLowerCase()
  const value = String(option.value ?? "").trim().toLocaleLowerCase()
  if (label === query) return 0
  if (value === query) return 1
  if (label.startsWith(query)) return 2
  if (value.startsWith(query)) return 3
  if (label.split(/[^a-z0-9]+/i).some(token => token.startsWith(query))) return 4
  if (value.split(/[^a-z0-9]+/i).some(token => token.startsWith(query))) return 5
  if (label.includes(query)) return 6
  if (value.includes(query)) return 7
  return 8
}

let comboboxSequence = 0
