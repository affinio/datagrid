import type {
  DataGridContextMenuAction,
  DataGridContextMenuState,
  OpenDataGridContextMenuInput,
} from "./dataGridContextMenuContracts"

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

export interface ResolveDataGridContextMenuPositionOptions {
  clientX: number
  clientY: number
  viewportWidth: number
  viewportHeight: number
  estimatedMenuWidth: number
  estimatedMenuHeight: number
}

const DEFAULT_CONTEXT_MENU_STATE: DataGridContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  zone: "cell",
  columnKey: null,
  rowId: null,
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

export function createDefaultDataGridContextMenuState(): DataGridContextMenuState {
  return { ...DEFAULT_CONTEXT_MENU_STATE }
}

export function createDataGridOpenContextMenuState(
  context: OpenDataGridContextMenuInput,
): DataGridContextMenuState {
  return {
    visible: true,
    x: 0,
    y: 0,
    zone: context.zone,
    columnKey: context.columnKey ?? null,
    rowId: context.rowId ?? null,
  }
}

export function resolveDataGridContextMenuActions(
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
  if (contextMenu.zone === "row-index") {
    return [
      { id: "insert-row-above", label: "Insert above" },
      { id: "insert-row-below", label: "Insert below" },
      { id: "cut-row", label: "Cut row" },
      { id: "copy-row", label: "Copy row" },
      { id: "paste-row", label: "Paste row" },
      { id: "delete-selected-rows", label: "Delete selected rows" },
    ]
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

export function resolveDataGridContextMenuPosition(
  options: ResolveDataGridContextMenuPositionOptions,
): Pick<DataGridContextMenuState, "x" | "y"> {
  const maxX = Math.max(8, options.viewportWidth - options.estimatedMenuWidth - 8)
  const maxY = Math.max(8, options.viewportHeight - options.estimatedMenuHeight - 8)

  return {
    x: clamp(options.clientX, 8, maxX),
    y: clamp(options.clientY, 8, maxY),
  }
}