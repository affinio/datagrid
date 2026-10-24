import type { DataGridFilterSnapshot, DataGridQuickFilterMode } from "@affino/datagrid-core"
import { mountDataGrid } from "../adapter/mountDataGrid.js"
import type {
  DataGridDomHandle,
  DataGridDomQuickFilterOptions,
  DataGridDomShellHandle,
  DataGridDomShellOptions,
  DataGridDomToolbarAction,
} from "../adapter/contracts.js"
import type { ResolvedColumnMenuOptions } from "./columnMenuController.js"

const DEFAULT_COLUMN_MENU_ITEMS = ["sort", "group", "pin", "condition", "filter"] as const

const DEFAULT_QUICK_FILTER_PLACEHOLDER = "Search rows"
const DEFAULT_QUICK_FILTER_DEBOUNCE_MS = 300

/** Mounts the DOM app shell: standard toolbar controls plus the lower-level DOM grid. */
export function mountDataGridShell<TRow>(
  element: HTMLElement,
  options: DataGridDomShellOptions<TRow>,
): DataGridDomShellHandle<TRow> {
  const { quickFilter, toolbar, columnMenu, ...gridOptions } = options
  const quickFilterOptions = resolveQuickFilter(quickFilter)
  const columnMenuOptions = resolveColumnMenu(columnMenu)
  const actions = toolbar?.actions ?? []
  assertUniqueActionKeys(actions)

  const document = element.ownerDocument
  const previousChildren = Array.from(element.childNodes)
  const shell = document.createElement("div")
  shell.className = "affino-grid-dom-shell"
  const toolbarElement = quickFilterOptions || actions.length > 0
    ? createToolbar(document)
    : null
  const filterControls = toolbarElement ? createFilterControls(document, quickFilterOptions) : null
  const actionButtons = toolbarElement ? createActionButtons(document, actions) : []
  const statusElement = toolbarElement ? document.createElement("output") : null
  if (statusElement) {
    statusElement.className = "affino-grid-dom-shell__status"
    statusElement.setAttribute("aria-live", "polite")
  }
  if (toolbarElement) toolbarElement.append(...(filterControls ? [filterControls] : []), ...actionButtons, ...(statusElement ? [statusElement] : []))
  const host = document.createElement("div")
  host.className = "affino-grid-dom-shell__grid"
  if (toolbarElement) shell.append(toolbarElement)
  shell.append(host)
  element.replaceChildren(shell)

  let grid: DataGridDomHandle<TRow>
  try {
    grid = mountDataGrid(host, {
      ...gridOptions,
      columnMenu: Boolean(columnMenuOptions && columnMenuOptions.trigger !== "contextmenu"),
      rowSelection: gridOptions.rowSelection ?? true,
    })
  } catch (error) {
    element.replaceChildren(...previousChildren)
    throw error
  }

  let columnMenuControllerPromise: Promise<{ dispose(): void } | null> = Promise.resolve(null)
  if (columnMenuOptions) {
    const gridElement = host.querySelector<HTMLElement>(".affino-grid-dom")
    if (!gridElement) {
      void grid.destroy()
      element.replaceChildren(...previousChildren)
      throw new Error("DataGrid shell failed to create its grid element.")
    }
    columnMenuControllerPromise = import("./columnMenuController.js").then(({ createDomColumnMenuController }) =>
      createDomColumnMenuController({ grid: gridElement, api: grid.api, menu: columnMenuOptions }))
  }

  const status = statusElement
  const input = toolbarElement?.querySelector<HTMLInputElement>(".affino-grid-dom-shell__quick-filter") ?? null
  const applyButton = toolbarElement?.querySelector<HTMLButtonElement>("[data-action='apply-filter']") ?? null
  const clearButton = toolbarElement?.querySelector<HTMLButtonElement>("[data-action='clear-filter']") ?? null
  const unsubscribeProjection = grid.api.events.on("projection:recomputed", () => {
    syncQuickFilterInput()
  })
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const actionDisposers: Array<() => void> = []

  const cancelDebounce = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const commitQuery = (draft: string): void => {
    if (!quickFilterOptions) return
    const query = draft.trim()
    const current = grid.api.rows.getSnapshot().filterModel
    const next: DataGridFilterSnapshot = {
      ...(current ?? {}),
      columnFilters: current?.columnFilters ?? {},
    }
    if (!query) delete next.quickFilter
    else {
      const columns = quickFilterOptions.columns?.length
        ? quickFilterOptions.columns
        : grid.api.columns.getSnapshot().visibleColumns
          .filter(column => column.column.capabilities?.searchable !== false)
          .map(column => column.key)
      next.quickFilter = {
        query,
        ...(columns?.length ? { columns } : {}),
        mode: quickFilterOptions.mode,
      }
    }
    const hasFilter = Boolean(next.quickFilter)
      || Object.values(next.columnFilters ?? {}).some(Boolean)
      || Object.values(next.columnStyleFilters ?? {}).some(Boolean)
      || Boolean(next.advancedExpression)
    grid.api.rows.setFilterModel(hasFilter ? next : null)
    if (applyButton) applyButton.disabled = true
  }
  const onInput = (): void => {
    if (!input || !quickFilterOptions) return
    if (clearButton) clearButton.disabled = input.value.trim().length === 0
    const applyMode = quickFilterOptions.applyMode
    if (applyMode === "manual") {
      if (applyButton) applyButton.disabled = input.value.trim() === readCommittedQuery()
      return
    }
    if (applyMode === "debounce") {
      cancelDebounce()
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        commitQuery(input?.value ?? "")
      }, quickFilterOptions.debounceMs)
      return
    }
    cancelDebounce()
    commitQuery(input.value)
  }
  const onApply = (): void => {
    if (!input) return
    cancelDebounce()
    commitQuery(input.value)
  }
  const onClear = (): void => {
    if (!input) return
    input.value = ""
    cancelDebounce()
    commitQuery("")
    input.focus()
  }
  const onFilterKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && quickFilterOptions && quickFilterOptions.applyMode === "manual") onApply()
    if (event.key === "Escape") {
      cancelDebounce()
      syncQuickFilterInput()
    }
  }
  input?.addEventListener("input", onInput)
  input?.addEventListener("keydown", onFilterKeyDown)
  applyButton?.addEventListener("click", onApply)
  clearButton?.addEventListener("click", onClear)

  actions.forEach((action, index) => {
    const button = actionButtons[index]
    if (!button) return
    const onClick = (): void => {
      button.disabled = true
      button.dataset.running = "true"
      if (status) status.textContent = ""
      void Promise.resolve().then(() => action.onAction(grid.api)).catch(error => {
        if (status) status.textContent = error instanceof Error ? error.message : String(error)
      }).finally(() => {
        delete button.dataset.running
        button.disabled = false
      })
    }
    button.addEventListener("click", onClick)
    actionDisposers.push(() => button.removeEventListener("click", onClick))
  })

  function readCommittedQuery(): string {
    return grid.api.rows.getSnapshot().filterModel?.quickFilter?.query?.trim() ?? ""
  }
  function syncQuickFilterInput(): void {
    if (!input) return
    const committed = readCommittedQuery()
    if (document.activeElement !== input || !quickFilterOptions || quickFilterOptions.applyMode !== "manual") input.value = committed
    if (applyButton) applyButton.disabled = input.value.trim() === committed
    if (clearButton) clearButton.disabled = !input.value && !committed
  }
  syncQuickFilterInput()

  let destroyPromise: Promise<void> | null = null
  const ready = Promise.all([grid.ready, columnMenuControllerPromise]).then(() => undefined)
  return {
    api: grid.api,
    ready,
    element: shell,
    toolbar: toolbarElement,
    destroy() {
      if (destroyPromise) return destroyPromise
      cancelDebounce()
      input?.removeEventListener("input", onInput)
      input?.removeEventListener("keydown", onFilterKeyDown)
      applyButton?.removeEventListener("click", onApply)
      clearButton?.removeEventListener("click", onClear)
      unsubscribeProjection()
      for (const dispose of actionDisposers) dispose()
      destroyPromise = columnMenuControllerPromise
        .catch(() => null)
        .then(controller => {
          controller?.dispose()
          return grid.destroy()
        })
        .finally(() => element.replaceChildren(...previousChildren))
      return destroyPromise
    },
  }
}

function resolveColumnMenu(
  value: boolean | import("../adapter/contracts.js").DataGridDomColumnMenuOptions | null | undefined,
): ResolvedColumnMenuOptions | null {
  if (value === false || value == null || (typeof value === "object" && value.enabled === false)) return null
  const options = typeof value === "object" ? value : {}
  const sourceItems = options.items ?? DEFAULT_COLUMN_MENU_ITEMS
  const items = DEFAULT_COLUMN_MENU_ITEMS.filter(item => sourceItems.includes(item))
  if (items.length === 0) return null
  const maxFilterValues = Number.isFinite(options.maxFilterValues)
    ? Math.max(1, Math.trunc(options.maxFilterValues!))
    : 120
  return {
    trigger: options.trigger === "button" || options.trigger === "contextmenu" ? options.trigger : "button+contextmenu",
    maxFilterValues,
    items,
  }
}

function resolveQuickFilter(
  value: boolean | DataGridDomQuickFilterOptions | null | undefined,
): false | (DataGridDomQuickFilterOptions & { placeholder: string; applyMode: "input" | "debounce" | "manual"; debounceMs: number; mode: DataGridQuickFilterMode }) {
  if (value === false || value == null) return false
  const options = typeof value === "object" ? value : {}
  const debounceMs = Number.isFinite(options.debounceMs)
    ? Math.max(0, Math.trunc(options.debounceMs!))
    : DEFAULT_QUICK_FILTER_DEBOUNCE_MS
  return {
    ...options,
    placeholder: options.placeholder?.trim() || DEFAULT_QUICK_FILTER_PLACEHOLDER,
    applyMode: options.applyMode === "manual" || options.applyMode === "debounce" ? options.applyMode : "input",
    debounceMs,
    mode: options.mode === "tokens" ? "tokens" : "contains",
  }
}

function createToolbar(document: Document): HTMLDivElement {
  const toolbar = document.createElement("div")
  toolbar.className = "affino-grid-dom-shell__toolbar"
  toolbar.setAttribute("role", "toolbar")
  toolbar.setAttribute("aria-label", "DataGrid actions")
  return toolbar
}

function assertUniqueActionKeys<TRow>(actions: readonly DataGridDomToolbarAction<TRow>[]): void {
  const keys = new Set<string>()
  for (const action of actions) {
    if (!action.key.trim()) throw new TypeError("DataGrid toolbar action keys must not be empty.")
    if (keys.has(action.key)) throw new TypeError(`Duplicate DataGrid toolbar action key: ${action.key}`)
    keys.add(action.key)
  }
}

function createFilterControls(document: Document, options: ReturnType<typeof resolveQuickFilter>): HTMLElement | null {
  if (!options) return null
  const container = document.createElement("div")
  container.className = "affino-grid-dom-shell__filter"
  const input = document.createElement("input")
  input.type = "search"
  input.className = "affino-grid-dom-shell__quick-filter"
  input.placeholder = options.placeholder
  input.setAttribute("aria-label", "Quick filter")
  input.autocomplete = "off"
  container.append(input)
  const clear = document.createElement("button")
  clear.type = "button"
  clear.textContent = "Clear"
  clear.dataset.action = "clear-filter"
  clear.setAttribute("aria-label", "Clear quick filter")
  container.append(clear)
  if (options.applyMode === "manual") {
    const apply = document.createElement("button")
    apply.type = "button"
    apply.textContent = "Apply"
    apply.dataset.action = "apply-filter"
    apply.disabled = true
    container.append(apply)
  }
  return container
}

function createActionButtons<TRow>(document: Document, actions: readonly DataGridDomToolbarAction<TRow>[]): HTMLButtonElement[] {
  return actions.map(action => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "affino-grid-dom-shell__action"
    button.textContent = action.label
    button.dataset.toolbarAction = action.key
    return button
  })
}
