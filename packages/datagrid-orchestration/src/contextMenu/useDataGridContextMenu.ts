import type {
  DataGridContextMenuAction,
  DataGridContextMenuState,
  OpenDataGridContextMenuInput,
} from "../internal/dataGridContextMenuContracts"
import {
  createDefaultDataGridContextMenuState,
  createDataGridOpenContextMenuState,
  resolveDataGridContextMenuPosition,
  resolveDataGridContextMenuActions,
} from "../internal/dataGridContextMenuState"

export {
  resolveDataGridContextMenuKeyboardIntent,
} from "../internal/dataGridContextMenuState"

export type {
  DataGridContextMenuKeyboardIntentInput,
  DataGridContextMenuKeyboardIntentResult,
} from "../internal/dataGridContextMenuState"

export interface UseDataGridContextMenuOptions {
  isColumnResizable?: (columnKey: string) => boolean
  onBeforeOpen?: () => void
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

export function useDataGridContextMenu(
  options: UseDataGridContextMenuOptions = {},
): UseDataGridContextMenuResult {
  let contextMenu = createDefaultDataGridContextMenuState()
  const listeners = new Set<(snapshot: DataGridContextMenuSnapshot) => void>()

  function createSnapshot(): DataGridContextMenuSnapshot {
    return {
      contextMenu,
      actions: resolveDataGridContextMenuActions(contextMenu, options.isColumnResizable),
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
    contextMenu = createDefaultDataGridContextMenuState()
    emit()
  }

  function openContextMenu(clientX: number, clientY: number, context: OpenDataGridContextMenuInput) {
    options.onBeforeOpen?.()
    const baseState = createDataGridOpenContextMenuState(context)
    const actionCount = resolveDataGridContextMenuActions(baseState, options.isColumnResizable).length
    const estimatedMenuWidth = 240
    const estimatedMenuHeight = Math.max(56, actionCount * 36 + 12)
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : clientX + estimatedMenuWidth + 16
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : clientY + estimatedMenuHeight + 16

    contextMenu = {
      ...baseState,
      ...resolveDataGridContextMenuPosition({
        clientX,
        clientY,
        viewportWidth,
        viewportHeight,
        estimatedMenuWidth,
        estimatedMenuHeight,
      }),
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
