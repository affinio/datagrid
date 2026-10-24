import { MenuCore, computePosition } from "@affino/menu-core"
import { createFloatingRelayoutController, ensureOverlayHost } from "@affino/overlay-host"
import type {
  DataGridApi,
  DataGridColumnHistogramEntry,
  DataGridColumnSnapshot,
  DataGridColumnPredicateOperator,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
} from "@affino/datagrid-core"
import type {
  DataGridDomColumnMenuItem,
  DataGridDomColumnMenuTrigger,
} from "../adapter/contracts.js"

const ACTION_IDS = ["sort-asc", "sort-desc", "sort-clear", "group-toggle", "pin-left", "pin-right", "pin-none"] as const

type MenuActionId = typeof ACTION_IDS[number]
type ActiveMenuAction = { id: MenuActionId; label: string; disabled: boolean; state?: string }

export interface ResolvedColumnMenuOptions {
  trigger: DataGridDomColumnMenuTrigger
  maxFilterValues: number
  items: readonly DataGridDomColumnMenuItem[]
}

export function createDomColumnMenuController<TRow>(options: {
  grid: HTMLElement
  api: DataGridApi<TRow>
  menu: ResolvedColumnMenuOptions
}): { dispose(): void } {
  const document = options.grid.ownerDocument
  const window = document.defaultView
  const overlayHost = ensureOverlayHost({ document })
  const host = overlayHost ?? document.body
  const id = `${options.grid.id || "affino-grid"}-column-menu`
  const panel = document.createElement("div")
  panel.className = "affino-grid-dom-column-menu"
  panel.id = `${id}-dialog`
  panel.hidden = true
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-label", "Column options")
  panel.dataset.datagridColumnMenuPanel = "true"
  host.append(panel)

  const onPanelKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !menu.getSnapshot().open) return
    event.preventDefault()
    restoreTriggerFocus = true
    menu.requestClose("keyboard")
  }
  panel.addEventListener("keydown", onPanelKeyDown)

  let activeColumnKey: string | null = null
  let activeTrigger: HTMLButtonElement | null = null
  let activeAnchor: HTMLElement | null = null
  let filterSection: HTMLDivElement | null = null
  let conditionSection: HTMLDivElement | null = null
  let valueList: HTMLDivElement | null = null
  let filterSearch: HTMLInputElement | null = null
  let filterStatus: HTMLOutputElement | null = null
  let applyFilterButton: HTMLButtonElement | null = null
  let selectedTokens = new Set<string>()
  let draftTokens = new Set<string>()
  let explicitFilter = false
  let filterDraftInitialized = false
  let visibleEntries: readonly DataGridColumnHistogramEntry[] = []
  let actionElements = new Map<MenuActionId, HTMLButtonElement>()
  let unregisterItems: Array<() => void> = []
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let loadRequest = 0
  let restoreTriggerFocus = false
  let keyboardOpened = false
  let disposed = false

  function configureTrigger(trigger: HTMLButtonElement, columnKey: string): void {
    trigger.id = `${id}-trigger-${columnKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`
    trigger.setAttribute("aria-haspopup", "dialog")
    trigger.setAttribute("aria-controls", panel.id)
  }

  const menu = new MenuCore({
    id,
    closeOnSelect: true,
    loopFocus: true,
    openDelay: 0,
    closeDelay: 0,
    mousePrediction: false,
  }, {
    onSelect: itemId => {
      if (isMenuActionId(itemId)) runMenuAction(itemId)
    },
  })
  const triggerProps = menu.getTriggerProps()
  const panelProps = menu.getPanelProps()
  const floatingRelayout = createFloatingRelayoutController({
    ...(window ? { window } : {}),
    onRelayout: positionPanel,
  })

  const unsubscribeMenu = menu.subscribe(state => {
    if (disposed) return
    if (!state.open) {
      if (!panel.hidden) closePanel()
      return
    }
    panel.hidden = false
    floatingRelayout.activate()
    positionPanel()
    syncMenuActionState()
    if (keyboardOpened) {
      keyboardOpened = false
      actionElements.get(state.activeItemId as MenuActionId)?.focus()
    }
  })

  function getColumn(key = activeColumnKey): DataGridColumnSnapshot | undefined {
    return key ? options.api.columns.get(key) : undefined
  }

  function isActionDisabled(action: MenuActionId, column: DataGridColumnSnapshot): boolean {
    if (action.startsWith("sort-") && action !== "sort-clear") {
      return column.column.capabilities?.sortable === false
    }
    if (action === "sort-clear") {
      return column.column.capabilities?.sortable === false
        || !options.api.rows.getSnapshot().sortModel.some(entry => entry.key === column.key)
    }
    if (action === "group-toggle") return column.column.capabilities?.groupable === false
    return false
  }

  function resolveActions(column: DataGridColumnSnapshot): ActiveMenuAction[] {
    const state = options.api.rows.getSnapshot()
    const sortDirection = state.sortModel.find(entry => entry.key === column.key)?.direction
    const groupBy = state.groupBy
    const grouped = groupBy?.fields.includes(column.key) === true
    const pin = column.pin
    const result: ActiveMenuAction[] = []
    for (const section of options.menu.items) {
      if (section === "sort") {
        result.push(
          { id: "sort-asc", label: "Sort ascending", disabled: isActionDisabled("sort-asc", column), state: sortDirection === "asc" ? "Active" : undefined },
          { id: "sort-desc", label: "Sort descending", disabled: isActionDisabled("sort-desc", column), state: sortDirection === "desc" ? "Active" : undefined },
          { id: "sort-clear", label: "Clear sort", disabled: isActionDisabled("sort-clear", column) },
        )
      } else if (section === "group") {
        result.push({
          id: "group-toggle",
          label: grouped ? "Remove from grouping" : "Group by this column",
          disabled: isActionDisabled("group-toggle", column),
          state: grouped ? `Level ${groupBy?.fields.indexOf(column.key)! + 1}` : undefined,
        })
      } else if (section === "pin") {
        result.push(
          { id: "pin-left", label: "Pin left", disabled: pin === "left", state: pin === "left" ? "Active" : undefined },
          { id: "pin-right", label: "Pin right", disabled: pin === "right", state: pin === "right" ? "Active" : undefined },
          { id: "pin-none", label: "Unpin", disabled: pin === "none", state: pin === "none" ? "Active" : undefined },
        )
      }
    }
    return result
  }

  function registerMenuActions(column: DataGridColumnSnapshot): readonly ActiveMenuAction[] {
    for (const unregister of unregisterItems.splice(0)) unregister()
    const actions = resolveActions(column)
    for (const action of actions) {
      unregisterItems.push(menu.registerItem(action.id, { disabled: action.disabled }))
    }
    menu.syncItemOrder(actions.map(action => action.id))
    return actions
  }

  function buildPanel(column: DataGridColumnSnapshot): void {
    const actions = registerMenuActions(column)
    const heading = document.createElement("div")
    heading.className = "affino-grid-dom-column-menu__title"
    heading.id = `${id}-title`
    heading.textContent = String(column.column.label ?? column.key)
    const separator = document.createElement("div")
    separator.className = "affino-grid-dom-column-menu__separator"
    const menuList = document.createElement("div")
    menuList.className = "affino-grid-dom-column-menu__actions"
    menuList.id = panelProps.id
    menuList.setAttribute("role", panelProps.role)
    menuList.tabIndex = panelProps.tabIndex
    menuList.setAttribute("aria-labelledby", activeTrigger?.id ?? heading.id)
    if (panelProps.onKeyDown) menuList.addEventListener("keydown", panelProps.onKeyDown)
    if (panelProps.onPointerEnter) menuList.addEventListener("pointerenter", panelProps.onPointerEnter as EventListener)
    if (panelProps.onPointerLeave) menuList.addEventListener("pointerleave", panelProps.onPointerLeave as EventListener)

    actionElements = new Map()
    for (const action of actions) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "affino-grid-dom-column-menu__item"
      button.dataset.menuAction = action.id
      button.textContent = action.label
      const stateLabel = action.state ? document.createElement("span") : null
      if (stateLabel) {
        stateLabel.className = "affino-grid-dom-column-menu__state"
        stateLabel.textContent = action.state ?? ""
        button.append(stateLabel)
      }
      const itemProps = menu.getItemProps(action.id)
      button.id = itemProps.id
      button.setAttribute("role", itemProps.role)
      button.tabIndex = itemProps.tabIndex
      button.dataset.state = itemProps["data-state"] ?? "idle"
      if (itemProps["aria-disabled"] === true) button.setAttribute("aria-disabled", "true")
      if (itemProps.onPointerEnter) button.addEventListener("pointerenter", itemProps.onPointerEnter as EventListener)
      if (itemProps.onClick) button.addEventListener("click", event => {
        event.preventDefault()
        event.stopPropagation()
        itemProps.onClick?.(event)
      })
      if (itemProps.onKeyDown) button.addEventListener("keydown", itemProps.onKeyDown)
      actionElements.set(action.id, button)
      menuList.append(button)
    }
    panel.replaceChildren(heading, separator, menuList)
    if (options.menu.items.includes("condition") && column.column.capabilities?.filterable !== false) {
      conditionSection = createConditionSection(column)
      panel.append(conditionSection)
    } else {
      conditionSection = null
    }
    if (options.menu.items.includes("filter") && column.column.capabilities?.filterable !== false) {
      filterSection = createFilterSection(column)
      panel.append(filterSection)
      void loadFilterValues(column.key, "")
    } else {
      filterSection = null
    }
  }

  function createFilterSection(column: DataGridColumnSnapshot): HTMLDivElement {
    const section = document.createElement("div")
    section.className = "affino-grid-dom-column-menu__filter"
    const sectionTitle = document.createElement("strong")
    sectionTitle.className = "affino-grid-dom-column-menu__section-title"
    sectionTitle.textContent = "Filter by values"
    const search = document.createElement("input")
    search.type = "search"
    search.className = "affino-grid-dom-column-menu__search"
    search.placeholder = "Search values"
    search.setAttribute("aria-label", `Search ${column.column.label ?? column.key} values`)
    const status = document.createElement("output")
    status.className = "affino-grid-dom-column-menu__status"
    status.setAttribute("aria-live", "polite")
    const list = document.createElement("div")
    list.className = "affino-grid-dom-column-menu__values"
    list.setAttribute("role", "group")
    list.setAttribute("aria-label", `${column.column.label ?? column.key} values`)
    const controls = document.createElement("div")
    controls.className = "affino-grid-dom-column-menu__filter-controls"
    const selectVisible = createButton("Select visible", "select-visible")
    const clearDraft = createButton("Clear selection", "clear-selection")
    const apply = createButton("Apply", "apply-filter")
    const clearFilter = createButton("Clear filter", "clear-filter")
    controls.append(selectVisible, clearDraft, apply, clearFilter)
    section.append(sectionTitle, search, status, list, controls)

    filterSearch = search
    filterStatus = status
    valueList = list
    applyFilterButton = apply
    search.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        list.querySelector<HTMLInputElement>("input")?.focus()
      }
    })
    search.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => void loadFilterValues(column.key, search.value), 180)
    })
    list.addEventListener("change", event => {
      const input = (event.target as Element | null)?.closest<HTMLInputElement>("input[data-filter-token]")
      if (!input) return
      if (input.checked) draftTokens.add(input.dataset.filterToken!)
      else draftTokens.delete(input.dataset.filterToken!)
      syncApplyButton()
    })
    list.addEventListener("keydown", event => {
      if (event.key === "Escape") return
      if (event.key === "ArrowUp" && (event.target as HTMLInputElement).parentElement?.previousElementSibling == null) {
        event.preventDefault()
        search.focus()
      }
      event.stopPropagation()
    })
    selectVisible.addEventListener("click", () => {
      for (const entry of visibleEntries) draftTokens.add(entry.token)
      renderFilterValues(visibleEntries)
    })
    clearDraft.addEventListener("click", () => {
      draftTokens.clear()
      renderFilterValues(visibleEntries)
    })
    apply.addEventListener("click", () => applyValueFilter(column.key))
    clearFilter.addEventListener("click", () => clearValueFilter(column.key))
    clearFilter.hidden = !readColumnFilter(column.key)
    return section
  }

  function createConditionSection(column: DataGridColumnSnapshot): HTMLDivElement {
    const section = document.createElement("div")
    section.className = "affino-grid-dom-column-menu__condition"
    const title = document.createElement("strong")
    title.className = "affino-grid-dom-column-menu__section-title"
    title.textContent = "Filter by condition"
    const current = options.api.rows.getSnapshot().filterModel?.columnFilters?.[column.key]
    const currentPredicate = current?.kind === "predicate" ? current : null
    const numeric = isNumericColumn(column)
    const operators: readonly DataGridColumnPredicateOperator[] = numeric
      ? ["equals", "notEquals", "gt", "gte", "lt", "lte", "between"]
      : ["contains", "startsWith", "endsWith", "equals", "notEquals"]
    const operator = document.createElement("select")
    operator.className = "affino-grid-dom-column-menu__operator"
    operator.setAttribute("aria-label", `${column.column.label ?? column.key} condition`)
    for (const value of operators) {
      const option = document.createElement("option")
      option.value = value
      option.textContent = conditionOperatorLabel(value)
      operator.append(option)
    }
    operator.value = currentPredicate && operators.includes(currentPredicate.operator)
      ? currentPredicate.operator
      : numeric ? "gte" : "contains"
    const value = document.createElement("input")
    value.type = numeric ? "number" : "text"
    value.className = "affino-grid-dom-column-menu__condition-value"
    value.setAttribute("aria-label", `${column.column.label ?? column.key} condition value`)
    value.value = currentPredicate?.value == null ? "" : String(currentPredicate.value)
    const upperValue = document.createElement("input")
    upperValue.type = "number"
    upperValue.className = "affino-grid-dom-column-menu__condition-value"
    upperValue.setAttribute("aria-label", `${column.column.label ?? column.key} maximum condition value`)
    upperValue.value = currentPredicate?.value2 == null ? "" : String(currentPredicate.value2)
    const controls = document.createElement("div")
    controls.className = "affino-grid-dom-column-menu__condition-controls"
    const apply = createButton("Apply condition", "apply-condition")
    const clear = createButton("Clear condition", "clear-condition")
    clear.hidden = currentPredicate == null
    controls.append(apply, clear)
    const syncInputs = (): void => { upperValue.hidden = operator.value !== "between" }
    syncInputs()
    operator.addEventListener("change", syncInputs)
    apply.addEventListener("click", () => {
      const selectedOperator = operator.value as DataGridColumnPredicateOperator
      const parsedValue = numeric ? Number(value.value) : value.value
      const parsedUpper = Number(upperValue.value)
      if ((numeric && !Number.isFinite(parsedValue)) || (selectedOperator === "between" && !Number.isFinite(parsedUpper))) return
      const next = cloneFilterModel(options.api.rows.getSnapshot().filterModel)
      next.columnFilters[column.key] = {
        kind: "predicate",
        operator: selectedOperator,
        value: parsedValue,
        ...(selectedOperator === "between" ? { value2: parsedUpper } : {}),
      }
      restoreTriggerFocus = true
      options.api.rows.setFilterModel(hasFilters(next) ? next : null)
      menu.close("programmatic")
    })
    clear.addEventListener("click", () => {
      const next = cloneFilterModel(options.api.rows.getSnapshot().filterModel)
      if (next.columnFilters[column.key]?.kind === "predicate") delete next.columnFilters[column.key]
      restoreTriggerFocus = true
      options.api.rows.setFilterModel(hasFilters(next) ? next : null)
      menu.close("programmatic")
    })
    section.append(title, operator, value, upperValue, controls)
    return section
  }

  function isNumericColumn(column: DataGridColumnSnapshot): boolean {
    const type = column.column.dataType ?? column.column.cellType
    return type === "number" || type === "currency" || type === "percent"
  }

  function conditionOperatorLabel(operator: DataGridColumnPredicateOperator): string {
    const labels: Record<DataGridColumnPredicateOperator, string> = {
      contains: "Contains",
      startsWith: "Starts with",
      endsWith: "Ends with",
      equals: "Equals",
      notEquals: "Does not equal",
      gt: "Greater than",
      gte: "At least",
      lt: "Less than",
      lte: "At most",
      between: "Between",
      isEmpty: "Is empty",
      notEmpty: "Is not empty",
      isNull: "Is null",
      notNull: "Is not null",
    }
    return labels[operator]
  }

  function createButton(label: string, action: string): HTMLButtonElement {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "affino-grid-dom-column-menu__small-action"
    button.textContent = label
    button.dataset.filterAction = action
    return button
  }

  function openForColumn(key: string, trigger: HTMLButtonElement | null, anchor: HTMLElement, reason: "pointer" | "keyboard"): void {
    const column = options.api.columns.get(key)
    if (!column) return
    const wasOpen = menu.getSnapshot().open
    activeColumnKey = key
    activeTrigger = trigger
    activeAnchor = anchor
    if (trigger) configureTrigger(trigger, column.key)
    trigger?.setAttribute("aria-expanded", "true")
    if (wasOpen) {
      selectedTokens = readSelectedTokens(key)
      draftTokens = new Set(selectedTokens)
      explicitFilter = hasValueSetFilter(key)
      filterDraftInitialized = false
      buildPanel(column)
      positionPanel()
      return
    }
    selectedTokens = readSelectedTokens(key)
    draftTokens = new Set(selectedTokens)
    explicitFilter = hasValueSetFilter(key)
    filterDraftInitialized = false
    buildPanel(column)
    keyboardOpened = reason === "keyboard"
    menu.open(reason)
  }

  function closePanel(): void {
    panel.hidden = true
    loadRequest += 1
    floatingRelayout.deactivate()
    if (activeTrigger) activeTrigger.setAttribute("aria-expanded", "false")
    if (filterSearch && searchTimer) clearTimeout(searchTimer)
    searchTimer = null
    for (const unregister of unregisterItems.splice(0)) unregister()
    actionElements.clear()
    if (restoreTriggerFocus) activeTrigger?.focus()
    restoreTriggerFocus = false
    keyboardOpened = false
  }

  function positionPanel(): void {
    if (!activeAnchor || panel.hidden) return
    const anchor = activeAnchor.getBoundingClientRect()
    const surface = panel.getBoundingClientRect()
    const position = computePosition(anchor, surface, {
      placement: "bottom",
      align: "start",
      gutter: 6,
      viewportPadding: 12,
    })
    panel.style.left = `${position.left}px`
    panel.style.top = `${position.top}px`
    panel.dataset.placement = position.placement
    panel.dataset.align = position.align
  }

  function syncMenuActionState(): void {
    const column = getColumn()
    if (!column) return
    const actions = new Map(resolveActions(column).map(action => [action.id, action]))
    for (const [actionId, button] of actionElements) {
      const action = actions.get(actionId)
      const itemProps = menu.getItemProps(actionId)
      if (!action) continue
      button.disabled = action.disabled
      button.tabIndex = itemProps.tabIndex
      button.dataset.state = itemProps["data-state"]
      if (itemProps["aria-disabled"] === true) button.setAttribute("aria-disabled", "true")
      else button.removeAttribute("aria-disabled")
      const stateLabel = button.querySelector<HTMLElement>(".affino-grid-dom-column-menu__state")
      if (action.state) {
        const badge = stateLabel ?? document.createElement("span")
        badge.className = "affino-grid-dom-column-menu__state"
        badge.textContent = action.state
        if (!badge.parentElement) button.append(badge)
      } else stateLabel?.remove()
    }
  }

  async function loadFilterValues(columnKey: string, search: string): Promise<void> {
    const request = ++loadRequest
    if (!filterStatus || !valueList) return
    filterStatus.textContent = "Loading values…"
    const query = search.trim()
    try {
      const result = options.api.columns.getHistogram(columnKey, {
        ignoreSelfFilter: true,
        orderBy: "valueAsc",
        limit: options.menu.maxFilterValues + 1,
        ...(query ? { search: query } : {}),
      })
      const entries = await result
      if (disposed || request !== loadRequest || activeColumnKey !== columnKey) return
      visibleEntries = entries.slice(0, options.menu.maxFilterValues)
      if (!filterDraftInitialized) {
        filterDraftInitialized = true
        if (!explicitFilter) {
          selectedTokens = new Set(visibleEntries.map(entry => entry.token))
          draftTokens = new Set(selectedTokens)
        }
      }
      filterStatus.textContent = entries.length > options.menu.maxFilterValues
        ? `Showing ${options.menu.maxFilterValues} values. Search to narrow the list.`
        : entries.length === 0 ? "No matching values." : `${draftTokens.size} selected`
      renderFilterValues(visibleEntries)
    } catch (error) {
      if (disposed || request !== loadRequest) return
      filterStatus.textContent = error instanceof Error ? error.message : "Unable to load values."
      valueList.replaceChildren()
    }
  }

  function renderFilterValues(entries: readonly DataGridColumnHistogramEntry[]): void {
    if (!valueList) return
    const fragment = document.createDocumentFragment()
    for (const entry of entries) {
      const label = document.createElement("label")
      label.className = "affino-grid-dom-column-menu__value"
      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.dataset.filterToken = entry.token
      checkbox.checked = draftTokens.has(entry.token)
      const text = document.createElement("span")
      text.textContent = entry.text ?? (entry.value == null ? "(Blanks)" : String(entry.value))
      const count = document.createElement("small")
      count.textContent = String(entry.count)
      label.append(checkbox, text, count)
      fragment.append(label)
    }
    valueList.replaceChildren(fragment)
    syncApplyButton()
  }

  function syncApplyButton(): void {
    if (applyFilterButton) applyFilterButton.disabled = setsEqual(draftTokens, selectedTokens)
    if (filterStatus) filterStatus.textContent = `${draftTokens.size} selected`
  }

  function readSelectedTokens(columnKey: string): Set<string> {
    const entry = options.api.rows.getSnapshot().filterModel?.columnFilters?.[columnKey]
    return entry?.kind === "valueSet" ? new Set(entry.tokens) : new Set()
  }

  function hasValueSetFilter(columnKey: string): boolean {
    return options.api.rows.getSnapshot().filterModel?.columnFilters?.[columnKey]?.kind === "valueSet"
  }

  function readColumnFilter(columnKey: string): unknown {
    return options.api.rows.getSnapshot().filterModel?.columnFilters?.[columnKey]
  }

  function applyValueFilter(columnKey: string): void {
    restoreTriggerFocus = true
    const current = options.api.rows.getSnapshot().filterModel
    const next = cloneFilterModel(current)
    if (draftTokens.size > 0) next.columnFilters[columnKey] = { kind: "valueSet", tokens: [...draftTokens] }
    else delete next.columnFilters[columnKey]
    options.api.rows.setFilterModel(hasFilters(next) ? next : null)
    selectedTokens = new Set(draftTokens)
    explicitFilter = draftTokens.size > 0
    menu.close("programmatic")
  }

  function clearValueFilter(columnKey: string): void {
    restoreTriggerFocus = true
    const current = options.api.rows.getSnapshot().filterModel
    const next = cloneFilterModel(current)
    delete next.columnFilters[columnKey]
    options.api.rows.setFilterModel(hasFilters(next) ? next : null)
    selectedTokens.clear()
    draftTokens.clear()
    explicitFilter = false
    menu.close("programmatic")
  }

  function cloneFilterModel(current: DataGridFilterSnapshot | null): DataGridFilterSnapshot {
    return {
      ...(current ?? {}),
      columnFilters: { ...(current?.columnFilters ?? {}) },
    }
  }

  function hasFilters(filterModel: DataGridFilterSnapshot): boolean {
    return Object.values(filterModel.columnFilters).some(Boolean)
      || Object.values(filterModel.columnStyleFilters ?? {}).some(Boolean)
      || Boolean(filterModel.advancedExpression)
      || Boolean(filterModel.quickFilter?.query.trim())
  }

  function runMenuAction(actionId: MenuActionId): void {
    const column = getColumn()
    if (!column) return
    const rows = options.api.rows
    const state = rows.getSnapshot()
    restoreTriggerFocus = true
    if (actionId === "sort-asc" || actionId === "sort-desc") {
      rows.setSortModel([{ key: column.key, direction: actionId === "sort-asc" ? "asc" : "desc" }])
    } else if (actionId === "sort-clear") {
      rows.setSortModel(state.sortModel.filter(entry => entry.key !== column.key))
    } else if (actionId === "group-toggle") {
      const current: DataGridGroupBySpec | null = state.groupBy
      const grouped = current?.fields.includes(column.key) === true
      if (grouped) {
        const fields = current!.fields.filter(field => field !== column.key)
        rows.setGroupBy(fields.length > 0 ? { ...current!, fields } : null)
      }
      else {
        rows.setGroupBy({ fields: [...(current?.fields ?? []), column.key], expandedByDefault: false })
      }
    } else if (actionId === "pin-left") options.api.columns.setPin(column.key, "left")
    else if (actionId === "pin-right") options.api.columns.setPin(column.key, "right")
    else if (actionId === "pin-none") options.api.columns.setPin(column.key, "none")
  }

  function isMenuActionId(value: string): value is MenuActionId {
    return (ACTION_IDS as readonly string[]).includes(value)
  }

  function onClickCapture(event: MouseEvent): void {
    const target = event.target as Element | null
    const trigger = target?.closest<HTMLButtonElement>("[data-column-menu-trigger]")
    if (!trigger || !options.grid.contains(trigger)) return
    event.preventDefault()
    event.stopPropagation()
    const key = trigger.dataset.columnMenuTrigger
    if (!key) return
    const isSameOpenTrigger = menu.getSnapshot().open && activeColumnKey === key
    if (isSameOpenTrigger) {
      menu.close("pointer")
      return
    }
    openForColumn(key, trigger, trigger, "pointer")
  }

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target as Element | null
    const trigger = target?.closest<HTMLButtonElement>("[data-column-menu-trigger]")
    if (trigger) {
      const key = trigger.dataset.columnMenuTrigger
      if (key) {
        const sameOpenTrigger = menu.getSnapshot().open && activeColumnKey === key
        activeColumnKey = key
        activeTrigger = trigger
        activeAnchor = trigger
        configureTrigger(trigger, key)
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault()
          event.stopPropagation()
          if (sameOpenTrigger) menu.close("keyboard")
          else {
            const column = options.api.columns.get(key)
            if (!column) return
            selectedTokens = readSelectedTokens(key)
            draftTokens = new Set(selectedTokens)
            explicitFilter = hasValueSetFilter(key)
            filterDraftInitialized = false
            buildPanel(column)
            keyboardOpened = true
            trigger.setAttribute("aria-expanded", "true")
            if (triggerProps.onKeyDown) triggerProps.onKeyDown(event)
            else menu.open("keyboard")
          }
        }
      }
      return
    }
    if (event.key === "Escape" && menu.getSnapshot().open) {
      event.preventDefault()
      event.stopPropagation()
      restoreTriggerFocus = true
      menu.requestClose("keyboard")
    }
  }

  function onContextMenu(event: MouseEvent): void {
    if (options.menu.trigger === "button") return
    const target = event.target as Element | null
    const header = target?.closest<HTMLElement>(".affino-grid-dom__column-header[data-column-index]")
    if (!header || !options.grid.contains(header)) return
    const key = options.api.columns.getSnapshot().visibleColumns[Number(header.dataset.columnIndex)]?.key
    if (!key) return
    event.preventDefault()
    event.stopPropagation()
    openForColumn(key, header.querySelector<HTMLButtonElement>("[data-column-menu-trigger]"), header, "pointer")
  }

  function onOutsidePointerDown(event: PointerEvent): void {
    if (!menu.getSnapshot().open) return
    const target = event.target as Node | null
    if (target && (panel.contains(target) || activeAnchor?.contains(target))) return
    menu.close("pointer")
  }

  function onGridScroll(): void {
    if (menu.getSnapshot().open) menu.close("pointer")
  }

  const unsubscribeProjection = options.api.events.on("projection:recomputed", () => {
    if (menu.getSnapshot().open) menu.close("programmatic")
  })
  const unsubscribeColumns = options.api.events.on("columns:changed", () => {
    if (menu.getSnapshot().open) menu.close("programmatic")
  })
  options.grid.addEventListener("click", onClickCapture, true)
  options.grid.addEventListener("keydown", onKeyDown, true)
  options.grid.addEventListener("contextmenu", onContextMenu, true)
  options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")?.addEventListener("scroll", onGridScroll, { passive: true })
  document.addEventListener("pointerdown", onOutsidePointerDown, true)

  function dispose(): void {
    if (disposed) return
    disposed = true
    unsubscribeMenu.unsubscribe()
    unsubscribeProjection()
    unsubscribeColumns()
    floatingRelayout.destroy()
    menu.destroy()
    for (const unregister of unregisterItems.splice(0)) unregister()
    if (searchTimer) clearTimeout(searchTimer)
    options.grid.removeEventListener("click", onClickCapture, true)
    options.grid.removeEventListener("keydown", onKeyDown, true)
    options.grid.removeEventListener("contextmenu", onContextMenu, true)
    options.grid.querySelector<HTMLElement>(".affino-grid-dom__body")?.removeEventListener("scroll", onGridScroll)
    document.removeEventListener("pointerdown", onOutsidePointerDown, true)
    panel.removeEventListener("keydown", onPanelKeyDown)
    panel.remove()
  }

  return { dispose }
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}
