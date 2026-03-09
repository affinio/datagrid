import { computed, ref, type ComputedRef } from "vue"
import type {
  DataGridAppApplyColumnLayoutPayload,
  DataGridAppColumnLayoutDraftColumn,
  DataGridAppColumnLayoutPanelItem,
  DataGridAppColumnLayoutVisibilityPatch,
} from "./columnLayoutPanel.types"

interface UseDataGridAppColumnLayoutPanelOptions {
  resolveColumns: () => readonly DataGridAppColumnLayoutDraftColumn[]
  applyColumnLayout: (payload: DataGridAppApplyColumnLayoutPayload) => void
}

export interface UseDataGridAppColumnLayoutPanelResult {
  isColumnLayoutPanelOpen: ComputedRef<boolean>
  columnLayoutPanelItems: ComputedRef<readonly DataGridAppColumnLayoutPanelItem[]>
  openColumnLayoutPanel: () => void
  cancelColumnLayoutPanel: () => void
  applyColumnLayoutPanel: () => void
  moveColumnUp: (key: string) => void
  moveColumnDown: (key: string) => void
  updateColumnVisibility: (patch: DataGridAppColumnLayoutVisibilityPatch) => void
}

export function useDataGridAppColumnLayoutPanel(
  options: UseDataGridAppColumnLayoutPanelOptions,
): UseDataGridAppColumnLayoutPanelResult {
  const isOpen = ref(false)
  const draftColumns = ref<DataGridAppColumnLayoutDraftColumn[]>([])

  const cloneColumns = (
    columns: readonly DataGridAppColumnLayoutDraftColumn[],
  ): DataGridAppColumnLayoutDraftColumn[] => {
    return columns.map(column => ({ ...column }))
  }

  const openColumnLayoutPanel = (): void => {
    draftColumns.value = cloneColumns(options.resolveColumns())
    isOpen.value = true
  }

  const cancelColumnLayoutPanel = (): void => {
    draftColumns.value = cloneColumns(options.resolveColumns())
    isOpen.value = false
  }

  const moveColumn = (key: string, direction: -1 | 1): void => {
    const index = draftColumns.value.findIndex(column => column.key === key)
    if (index < 0) {
      return
    }
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= draftColumns.value.length) {
      return
    }
    const nextDraft = [...draftColumns.value]
    const current = nextDraft[index]
    const target = nextDraft[nextIndex]
    if (!current || !target) {
      return
    }
    nextDraft[index] = target
    nextDraft[nextIndex] = current
    draftColumns.value = nextDraft
  }

  const moveColumnUp = (key: string): void => {
    moveColumn(key, -1)
  }

  const moveColumnDown = (key: string): void => {
    moveColumn(key, 1)
  }

  const updateColumnVisibility = (patch: DataGridAppColumnLayoutVisibilityPatch): void => {
    draftColumns.value = draftColumns.value.map(column => {
      if (column.key !== patch.key) {
        return column
      }
      return {
        ...column,
        visible: patch.visible,
      }
    })
  }

  const applyColumnLayoutPanel = (): void => {
    const order = draftColumns.value.map(column => column.key)
    const visibilityByKey = Object.fromEntries(draftColumns.value.map(column => [column.key, column.visible]))
    options.applyColumnLayout({ order, visibilityByKey })
    isOpen.value = false
  }

  const columnLayoutPanelItems = computed<readonly DataGridAppColumnLayoutPanelItem[]>(() => {
    return draftColumns.value.map((column, index) => ({
      ...column,
      canMoveUp: index > 0,
      canMoveDown: index < draftColumns.value.length - 1,
    }))
  })

  return {
    isColumnLayoutPanelOpen: computed(() => isOpen.value),
    columnLayoutPanelItems,
    openColumnLayoutPanel,
    cancelColumnLayoutPanel,
    applyColumnLayoutPanel,
    moveColumnUp,
    moveColumnDown,
    updateColumnVisibility,
  }
}
