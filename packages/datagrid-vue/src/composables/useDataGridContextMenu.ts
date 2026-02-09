import { computed, nextTick, ref, type Ref } from "vue"

export type DataGridContextMenuZone = "cell" | "range" | "header"

export type DataGridContextMenuActionId =
  | "copy"
  | "paste"
  | "cut"
  | "clear"
  | "sort-asc"
  | "sort-desc"
  | "sort-clear"
  | "filter"
  | "auto-size"

export interface DataGridContextMenuState {
  visible: boolean
  x: number
  y: number
  zone: DataGridContextMenuZone
  columnKey: string | null
  rowId: string | null
}

export interface DataGridContextMenuAction {
  id: DataGridContextMenuActionId
  label: string
}

export interface OpenDataGridContextMenuInput {
  zone: DataGridContextMenuZone
  columnKey?: string | null
  rowId?: string | null
}

export interface UseDataGridContextMenuOptions {
  isColumnResizable?: (columnKey: string) => boolean
  onBeforeOpen?: () => void
}

export interface UseDataGridContextMenuResult {
  contextMenu: Ref<DataGridContextMenuState>
  contextMenuRef: Ref<HTMLElement | null>
  contextMenuStyle: Ref<{ left: string; top: string }>
  contextMenuActions: Ref<readonly DataGridContextMenuAction[]>
  closeContextMenu: () => void
  openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
  onContextMenuKeyDown: (event: KeyboardEvent, handlers?: { onEscape?: () => void }) => void
}

const DEFAULT_CONTEXT_MENU_STATE: DataGridContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  zone: "cell",
  columnKey: null,
  rowId: null,
}

function createDefaultState(): DataGridContextMenuState {
  return { ...DEFAULT_CONTEXT_MENU_STATE }
}

export function useDataGridContextMenu(
  options: UseDataGridContextMenuOptions = {},
): UseDataGridContextMenuResult {
  const contextMenu = ref<DataGridContextMenuState>(createDefaultState())
  const contextMenuRef = ref<HTMLElement | null>(null)

  const contextMenuStyle = computed(() => ({
    left: `${contextMenu.value.x}px`,
    top: `${contextMenu.value.y}px`,
  }))

  const contextMenuActions = computed<readonly DataGridContextMenuAction[]>(() => {
    if (!contextMenu.value.visible) {
      return []
    }
    if (contextMenu.value.zone === "header") {
      const actions: DataGridContextMenuAction[] = [
        { id: "sort-asc", label: "Sort ascending" },
        { id: "sort-desc", label: "Sort descending" },
        { id: "sort-clear", label: "Clear sort" },
        { id: "filter", label: "Filter column" },
      ]
      const canResize = typeof contextMenu.value.columnKey === "string" &&
        contextMenu.value.columnKey.length > 0 &&
        (options.isColumnResizable?.(contextMenu.value.columnKey) ?? false)
      if (canResize) {
        actions.push({ id: "auto-size", label: "Auto size column" })
      }
      return actions
    }
    return [
      { id: "cut", label: "Cut" },
      { id: "paste", label: "Paste" },
      { id: "copy", label: "Copy" },
      { id: "clear", label: "Clear values" },
    ]
  })

  function closeContextMenu() {
    contextMenu.value = createDefaultState()
  }

  async function focusContextMenuFirstItem() {
    await nextTick()
    const menu = contextMenuRef.value
    if (!menu) {
      return
    }
    const first = menu.querySelector('[data-datagrid-menu-action]') as HTMLButtonElement | null
    if (first) {
      first.focus()
      return
    }
    menu.focus()
  }

  function openContextMenu(clientX: number, clientY: number, context: OpenDataGridContextMenuInput) {
    options.onBeforeOpen?.()
    contextMenu.value = {
      visible: true,
      x: Math.max(8, clientX),
      y: Math.max(8, clientY),
      zone: context.zone,
      columnKey: context.columnKey ?? null,
      rowId: context.rowId ?? null,
    }
    void focusContextMenuFirstItem()
  }

  function onContextMenuKeyDown(event: KeyboardEvent, handlers?: { onEscape?: () => void }) {
    const menu = contextMenuRef.value
    if (!menu) {
      return
    }
    const items = Array.from(menu.querySelectorAll('[data-datagrid-menu-action]')) as HTMLButtonElement[]
    if (!items.length) {
      return
    }
    const active = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null
    let index = items.findIndex(item => item === active)

    if (event.key === "ArrowDown") {
      event.preventDefault()
      index = index < 0 ? 0 : (index + 1) % items.length
      items[index]?.focus()
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      index = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
      items[index]?.focus()
      return
    }
    if (event.key === "Home") {
      event.preventDefault()
      items[0]?.focus()
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      items[items.length - 1]?.focus()
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      const target = index >= 0 ? items[index] : items[0]
      target?.click()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      closeContextMenu()
      handlers?.onEscape?.()
      return
    }
    if (event.key === "Tab") {
      event.preventDefault()
      const nextIndex = event.shiftKey
        ? (index <= 0 ? items.length - 1 : index - 1)
        : (index + 1) % items.length
      items[nextIndex]?.focus()
    }
  }

  return {
    contextMenu,
    contextMenuRef,
    contextMenuStyle,
    contextMenuActions,
    closeContextMenu,
    openContextMenu,
    onContextMenuKeyDown,
  }
}
