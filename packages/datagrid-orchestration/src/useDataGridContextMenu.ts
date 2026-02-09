import type {
  DataGridContextMenuAction,
  DataGridContextMenuState,
  OpenDataGridContextMenuInput,
} from "./dataGridContextMenuContracts"

export interface UseDataGridContextMenuOptions {
  isColumnResizable?: (columnKey: string) => boolean
  onBeforeOpen?: () => void
}

export interface DataGridContextMenuKeyboardIntentInput {
  key: string
  activeIndex: number
  itemCount: number
  shiftKey?: boolean
}

export interface DataGridContextMenuKeyboardIntentResult {
  handled: boolean
  nextIndex: number
  shouldTrigger: boolean
  shouldClose: boolean
}

export interface DataGridContextMenuSnapshot {
  contextMenu: DataGridContextMenuState
  actions: readonly DataGridContextMenuAction[]
}

export interface UseDataGridContextMenuResult {
  getSnapshot: () => DataGridContextMenuSnapshot
  subscribe: (listener: (snapshot: DataGridContextMenuSnapshot) => void) => () => void
  closeContextMenu: () => void
  openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  if (max <= min) {
    return min
  }
  return Math.max(min, Math.min(max, value))
}

function resolveContextMenuActions(
  contextMenu: DataGridContextMenuState,
  isColumnResizable?: (columnKey: string) => boolean,
): readonly DataGridContextMenuAction[] {
  if (!contextMenu.visible) {
    return []
  }
  if (contextMenu.zone === "header") {
    const actions: DataGridContextMenuAction[] = [
      { id: "sort-asc", label: "Sort ascending" },
      { id: "sort-desc", label: "Sort descending" },
      { id: "sort-clear", label: "Clear sort" },
      { id: "filter", label: "Filter column" },
    ]
    const canResize = typeof contextMenu.columnKey === "string" &&
      contextMenu.columnKey.length > 0 &&
      (isColumnResizable?.(contextMenu.columnKey) ?? false)
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
}

export function resolveDataGridContextMenuKeyboardIntent(
  input: DataGridContextMenuKeyboardIntentInput,
): DataGridContextMenuKeyboardIntentResult {
  const count = input.itemCount
  if (count <= 0) {
    return { handled: false, nextIndex: -1, shouldTrigger: false, shouldClose: false }
  }
  const normalizedIndex = input.activeIndex >= 0 ? input.activeIndex : 0

  if (input.key === "ArrowDown") {
    return {
      handled: true,
      nextIndex: (normalizedIndex + 1) % count,
      shouldTrigger: false,
      shouldClose: false,
    }
  }
  if (input.key === "ArrowUp") {
    return {
      handled: true,
      nextIndex: (normalizedIndex - 1 + count) % count,
      shouldTrigger: false,
      shouldClose: false,
    }
  }
  if (input.key === "Home") {
    return { handled: true, nextIndex: 0, shouldTrigger: false, shouldClose: false }
  }
  if (input.key === "End") {
    return { handled: true, nextIndex: count - 1, shouldTrigger: false, shouldClose: false }
  }
  if (input.key === "Enter" || input.key === " ") {
    return { handled: true, nextIndex: normalizedIndex, shouldTrigger: true, shouldClose: false }
  }
  if (input.key === "Escape") {
    return { handled: true, nextIndex: normalizedIndex, shouldTrigger: false, shouldClose: true }
  }
  if (input.key === "Tab") {
    return {
      handled: true,
      nextIndex: input.shiftKey
        ? (normalizedIndex <= 0 ? count - 1 : normalizedIndex - 1)
        : (normalizedIndex + 1) % count,
      shouldTrigger: false,
      shouldClose: false,
    }
  }

  return { handled: false, nextIndex: normalizedIndex, shouldTrigger: false, shouldClose: false }
}

export function useDataGridContextMenu(
  options: UseDataGridContextMenuOptions = {},
): UseDataGridContextMenuResult {
  let contextMenu = createDefaultState()
  const listeners = new Set<(snapshot: DataGridContextMenuSnapshot) => void>()

  function createSnapshot(): DataGridContextMenuSnapshot {
    return {
      contextMenu,
      actions: resolveContextMenuActions(contextMenu, options.isColumnResizable),
    }
  }

  function emit() {
    const snapshot = createSnapshot()
    listeners.forEach(listener => listener(snapshot))
  }

  function subscribe(listener: (snapshot: DataGridContextMenuSnapshot) => void): () => void {
    listeners.add(listener)
    listener(createSnapshot())
    return () => {
      listeners.delete(listener)
    }
  }

  function closeContextMenu() {
    contextMenu = createDefaultState()
    emit()
  }

  function openContextMenu(clientX: number, clientY: number, context: OpenDataGridContextMenuInput) {
    options.onBeforeOpen?.()
    const baseState: DataGridContextMenuState = {
      visible: true,
      x: 0,
      y: 0,
      zone: context.zone,
      columnKey: context.columnKey ?? null,
      rowId: context.rowId ?? null,
    }
    const actionCount = resolveContextMenuActions(baseState, options.isColumnResizable).length
    const estimatedMenuWidth = 240
    const estimatedMenuHeight = Math.max(56, actionCount * 36 + 12)
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : clientX + estimatedMenuWidth + 16
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : clientY + estimatedMenuHeight + 16
    const maxX = Math.max(8, viewportWidth - estimatedMenuWidth - 8)
    const maxY = Math.max(8, viewportHeight - estimatedMenuHeight - 8)

    contextMenu = {
      ...baseState,
      x: clamp(clientX, 8, maxX),
      y: clamp(clientY, 8, maxY),
    }
    emit()
  }

  return {
    getSnapshot: createSnapshot,
    subscribe,
    closeContextMenu,
    openContextMenu,
  }
}
