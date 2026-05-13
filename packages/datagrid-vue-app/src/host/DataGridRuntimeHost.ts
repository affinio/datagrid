import {
  computed,
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  provide,
  ref,
  nextTick,
  watch,
  type PropType,
  type VNode,
} from "vue"
import type {
  CreateDataGridCoreOptions,
  DataGridApiPluginDefinition,
  DataGridColumnInput,
  DataGridCoreServiceRegistry,
  DataGridPaginationInput,
  DataGridRowId,
  DataGridRowSelectionSnapshot,
  DataGridRowModel,
  DataGridRowNode,
  DataGridRowModelSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-vue"
import { useDataGridRuntime } from "@affino/datagrid-vue"
import {
  applyDataGridTheme,
  type DataGridThemeProp,
} from "../theme/dataGridTheme"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import type { DataGridLayoutMode } from "../config/dataGridLayout"

type DataGridRuntimeOverrides = Omit<
  Partial<DataGridCoreServiceRegistry>,
  "rowModel" | "columnModel" | "viewport"
> & {
  viewport?: DataGridCoreServiceRegistry["viewport"]
}

export interface DataGridFocusAnchor<TRowKey = DataGridRowId> {
  version: 1
  rowId: TRowKey | null
  rowIndex: number | null
  columnKey: string | null
  columnIndex: number | null
  selection: DataGridSelectionSnapshot<TRowKey> | null
  rowSelection: DataGridRowSelectionSnapshot | null
}

export interface DataGridCaptureFocusAnchorOptions {
  includeSelection?: boolean
  includeRowSelection?: boolean
}

export interface DataGridRestoreFocusAnchorOptions {
  applySelection?: boolean
  applyRowSelection?: boolean
  focus?: boolean
  preventScroll?: boolean
  scrollIntoView?: boolean
  retries?: number
}

interface DataGridRowsChangedEvent {
  snapshot: DataGridRowModelSnapshot<unknown>
}

function cloneSerializable<T>(value: T): T {
  if (value == null) {
    return value
  }
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(input: U) => U
  }).structuredClone
  if (typeof structuredCloneRef === "function") {
    try {
      return structuredCloneRef(value)
    } catch {
      // Fall through to JSON clone.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function normalizeDomIndex(value: string | null): number | null {
  if (value == null || value.trim().length === 0) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
}

function escapeCssValue(value: string): string {
  const cssEscape = (globalThis as typeof globalThis & {
    CSS?: { escape?: (input: string) => string }
  }).CSS?.escape
  if (typeof cssEscape === "function") {
    return cssEscape(value)
  }
  return value.replace(/["\\]/g, "\\$&")
}

interface DataGridSelectionChangedEvent {
  snapshot: DataGridSelectionSnapshot | null
}

interface DataGridRowSelectionChangedEvent {
  snapshot: DataGridRowSelectionSnapshot | null
}

export default defineComponent({
  name: "DataGridRuntimeHost",
  inheritAttrs: false,
  props: {
    rows: {
      type: Array as PropType<readonly unknown[]>,
      default: () => [],
    },
    rowModel: {
      type: Object as PropType<DataGridRowModel<unknown> | undefined>,
      default: undefined,
    },
    columns: {
      type: Array as PropType<readonly DataGridColumnInput[]>,
      default: () => [],
    },
    theme: {
      type: [String, Object] as PropType<DataGridThemeProp>,
      default: undefined,
    },
    layoutMode: {
      type: String as PropType<DataGridLayoutMode>,
      default: "fill",
    },
    plugins: {
      type: Array as PropType<readonly DataGridApiPluginDefinition<unknown>[]>,
      default: () => [],
    },
    services: {
      type: Object as PropType<DataGridRuntimeOverrides | undefined>,
      default: undefined,
    },
    startupOrder: {
      type: Array as PropType<CreateDataGridCoreOptions["startupOrder"] | undefined>,
      default: undefined,
    },
    autoStart: {
      type: Boolean,
      default: true,
    },
    renderMode: {
      type: String as PropType<"virtualization" | "pagination">,
      default: "virtualization",
    },
    pagination: {
      type: Object as PropType<DataGridPaginationInput | null>,
      default: null,
    },
  },
  emits: {
    "cell-change": (_payload: DataGridRowsChangedEvent) => true,
    "selection-change": (_payload: DataGridSelectionChangedEvent) => true,
    "row-selection-change": (_payload: DataGridRowSelectionChangedEvent) => true,
  },
  setup(props, { attrs, slots, emit, expose }) {
    const rootElementRef = ref<HTMLElement | null>(null)
    provide(dataGridAppRootElementKey, rootElementRef)
    let themeObserver: MutationObserver | null = null
    const runtime = useDataGridRuntime({
      rows: computed(() => props.rows),
      rowModel: props.rowModel,
      columns: computed(() => props.columns),
      plugins: props.plugins,
      services: props.services,
      startupOrder: props.startupOrder,
      autoStart: props.autoStart,
    })
    const bodyRuntime = runtime as typeof runtime & {
      getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<unknown> | null
      resolveBodyRowIndexById: (rowId: string | number) => number
      setVirtualWindowRange?: (range: { start: number; end: number }) => void
    }
    const publicRuntime = {
      api: runtime.api,
      syncBodyRowsInRange: runtime.syncBodyRowsInRange,
      setViewportRange: runtime.setViewportRange,
      setVirtualWindowRange: runtime.setVirtualWindowRange,
      setRows: runtime.setRows,
      rowPartition: runtime.rowPartition,
      virtualWindow: runtime.virtualWindow,
      columnSnapshot: runtime.columnSnapshot,
      getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
      resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
      getViewportPosition: runtime.getViewportPosition,
      setViewportPosition: runtime.setViewportPosition,
      scrollToRow: runtime.scrollToRow,
      scrollToColumn: runtime.scrollToColumn,
      scrollToCell: runtime.scrollToCell,
    }

    const syncPaginationState = (): void => {
      if (props.renderMode === "pagination") {
        const pagination = props.pagination ?? { pageSize: 100, currentPage: 0 }
        runtime.api.rows.setPagination({
          pageSize: Math.max(1, Math.trunc(pagination.pageSize)),
          currentPage: Math.max(0, Math.trunc(pagination.currentPage)),
        })
        return
      }
      runtime.api.rows.setPagination(null)
    }

    watch(
      () => props.renderMode,
      () => {
        syncPaginationState()
      },
      { immediate: true },
    )

    watch(
      () => props.pagination,
      () => {
        syncPaginationState()
      },
      { immediate: true, deep: true },
    )

    if (typeof document !== "undefined") {
      themeObserver = new MutationObserver(() => {
        const rootElement = rootElementRef.value
        if (!rootElement) {
          return
        }
        applyDataGridTheme(rootElement, props.theme)
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      })
    }

    watch(
      [() => props.theme, rootElementRef],
      () => {
        const rootElement = rootElementRef.value
        if (!rootElement) {
          return
        }
        applyDataGridTheme(rootElement, props.theme)
      },
      { immediate: true, deep: true },
    )

    const unsubscribeRowsChanged = runtime.api.events.on("rows:changed", payload => {
      emit("cell-change", payload as DataGridRowsChangedEvent)
    })
    const unsubscribeSelectionChanged = runtime.api.events.on("selection:changed", payload => {
      emit("selection-change", payload as DataGridSelectionChangedEvent)
    })
    const unsubscribeRowSelectionChanged = runtime.api.events.on("row-selection:changed", payload => {
      emit("row-selection-change", payload as DataGridRowSelectionChangedEvent)
    })

    onBeforeUnmount(() => {
      unsubscribeRowsChanged()
      unsubscribeSelectionChanged()
      unsubscribeRowSelectionChanged()
      themeObserver?.disconnect()
      themeObserver = null
    })

    const slotVirtualWindow = computed(() => {
      const window = runtime.virtualWindow.value
      return {
        ...(window ?? {}),
        rowTotal: window?.rowTotal ?? runtime.rowPartition.value.bodyRowCount,
        colTotal: runtime.columnSnapshot.value.visibleColumns.length,
      }
    })

    const findActiveGridCell = (): HTMLElement | null => {
      if (typeof document === "undefined") {
        return null
      }
      const rootElement = rootElementRef.value
      const activeElement = document.activeElement
      if (!rootElement || !(activeElement instanceof HTMLElement) || !rootElement.contains(activeElement)) {
        return null
      }
      return activeElement.closest<HTMLElement>(".grid-cell[data-row-index], .grid-cell[data-row-id]")
    }

    const resolveColumnKeyByIndex = (columnIndex: number | null): string | null => {
      if (columnIndex == null) {
        return null
      }
      return runtime.columnSnapshot.value.visibleColumns[columnIndex]?.key ?? null
    }

    const captureFocusAnchor = (
      options: DataGridCaptureFocusAnchorOptions = {},
    ): DataGridFocusAnchor | null => {
      const selectionSnapshot = runtime.api.selection.getSnapshot() as DataGridSelectionSnapshot<DataGridRowId> | null
      const activeCell = selectionSnapshot?.activeCell ?? null
      const activeElement = findActiveGridCell()
      const elementRowIndex = normalizeDomIndex(activeElement?.getAttribute("data-row-index") ?? null)
      const elementColumnIndex = normalizeDomIndex(activeElement?.getAttribute("data-column-index") ?? null)
      const elementColumnKey = activeElement?.getAttribute("data-column-key") ?? null
      const elementRowId = activeElement?.getAttribute("data-row-id") ?? null
      const rowIndex = elementRowIndex ?? activeCell?.rowIndex ?? null
      const activeCellMatchesElement = activeCell != null && (
        (elementRowIndex == null && elementRowId == null) ||
        activeCell.rowIndex === elementRowIndex ||
        (activeCell.rowId != null && String(activeCell.rowId) === elementRowId)
      )
      const columnIndex = activeCellMatchesElement ? activeCell?.colIndex ?? elementColumnIndex : elementColumnIndex ?? activeCell?.colIndex ?? null
      const rawRowId = activeCellMatchesElement
        ? activeCell?.rowId ?? elementRowId
        : elementRowId ?? activeCell?.rowId ?? null
      const rowId = typeof rawRowId === "string" || typeof rawRowId === "number" ? rawRowId : null
      const columnKey = elementColumnKey ?? resolveColumnKeyByIndex(columnIndex)
      const hasLogicalAnchor = rowId != null || rowIndex != null || columnKey != null || columnIndex != null
      const shouldIncludeSelection = options.includeSelection !== false
      const shouldIncludeRowSelection = options.includeRowSelection !== false

      if (!hasLogicalAnchor && !selectionSnapshot && !runtime.api.rowSelection.getSnapshot()) {
        return null
      }

      return {
        version: 1,
        rowId,
        rowIndex,
        columnKey,
        columnIndex,
        selection: shouldIncludeSelection ? cloneSerializable(selectionSnapshot) : null,
        rowSelection: shouldIncludeRowSelection ? cloneSerializable(runtime.api.rowSelection.getSnapshot()) : null,
      }
    }

    const focusCellElement = (anchor: DataGridFocusAnchor, options: DataGridRestoreFocusAnchorOptions): boolean => {
      const rootElement = rootElementRef.value
      if (!rootElement) {
        return false
      }
      const selectors: string[] = []
      if (anchor.rowIndex != null && anchor.columnKey) {
        selectors.push(
          `.grid-cell[data-row-index="${anchor.rowIndex}"][data-column-key="${escapeCssValue(anchor.columnKey)}"]`,
        )
      }
      if (anchor.rowIndex != null && anchor.columnIndex != null) {
        selectors.push(`.grid-cell[data-row-index="${anchor.rowIndex}"][data-column-index="${anchor.columnIndex}"]`)
      }
      if (anchor.rowId != null && anchor.columnKey) {
        selectors.push(
          `.grid-cell[data-row-id="${escapeCssValue(String(anchor.rowId))}"][data-column-key="${escapeCssValue(anchor.columnKey)}"]`,
        )
      }
      if (selectors.length === 0) {
        return false
      }
      let target: HTMLElement | null = null
      for (const selector of selectors) {
        target = rootElement.querySelector<HTMLElement>(selector)
        if (target) {
          break
        }
      }
      if (!target) {
        return false
      }
      try {
        target.focus({ preventScroll: options.preventScroll !== false })
      } catch {
        target.focus()
      }
      return typeof document === "undefined" || document.activeElement === target
    }

    const restoreFocusAnchor = async (
      anchor: DataGridFocusAnchor | null | undefined,
      options: DataGridRestoreFocusAnchorOptions = {},
    ): Promise<boolean> => {
      if (!anchor) {
        return false
      }
      if (options.applySelection !== false && anchor.selection) {
        runtime.api.selection.setSnapshot(cloneSerializable(anchor.selection))
      }
      if (options.applyRowSelection !== false && anchor.rowSelection) {
        runtime.api.rowSelection.setSnapshot(cloneSerializable(anchor.rowSelection))
      }
      if (options.focus === false) {
        return true
      }

      const rowId = typeof anchor.rowId === "string" || typeof anchor.rowId === "number" ? anchor.rowId : null
      const resolvedRowIndex = rowId != null ? bodyRuntime.resolveBodyRowIndexById(rowId) : -1
      const rowIndex = resolvedRowIndex >= 0 ? resolvedRowIndex : anchor.rowIndex
      const columnIndex = anchor.columnKey
        ? runtime.columnSnapshot.value.visibleColumns.findIndex(column => column.key === anchor.columnKey)
        : -1
      const nextAnchor: DataGridFocusAnchor = {
        ...anchor,
        rowIndex: rowIndex != null && rowIndex >= 0 ? rowIndex : anchor.rowIndex,
        columnIndex: columnIndex >= 0 ? columnIndex : anchor.columnIndex,
      }
      if (nextAnchor.rowIndex == null || (nextAnchor.columnKey == null && nextAnchor.columnIndex == null)) {
        return false
      }

      if (options.scrollIntoView !== false) {
        runtime.scrollToCell({
          rowId,
          rowIndex: nextAnchor.rowIndex,
          columnKey: nextAnchor.columnKey,
          columnIndex: nextAnchor.columnIndex,
          align: "nearest",
        })
      }

      const attempts = Math.max(0, Math.trunc(options.retries ?? 3))
      for (let attempt = 0; attempt <= attempts; attempt += 1) {
        await nextTick()
        if (focusCellElement(nextAnchor, options)) {
          return true
        }
        if (typeof window !== "undefined") {
          await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
        }
      }
      return false
    }

    const restoreFocus = (): void => {
      const focusViewport = (): boolean => {
        const viewport = rootElementRef.value?.querySelector<HTMLElement>(".grid-body-viewport")
        if (!viewport) {
          return false
        }
        try {
          viewport.focus({ preventScroll: true })
        } catch {
          viewport.focus()
        }
        return typeof document !== "undefined" && document.activeElement === viewport
      }

      const runAttempt = (attempt: number): void => {
        void nextTick(() => {
          if (focusViewport() || attempt >= 3) {
            return
          }
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              runAttempt(attempt + 1)
            })
            return
          }
          runAttempt(attempt + 1)
        })
      }

      runAttempt(0)
    }

    expose({
      api: runtime.api,
      core: runtime.core,
      runtime: publicRuntime,
      rowModel: runtime.rowModel,
      columnModel: runtime.columnModel,
      columnSnapshot: runtime.columnSnapshot,
      rowPartition: runtime.rowPartition,
      setRows: runtime.setRows,
      syncBodyRowsInRange: runtime.syncBodyRowsInRange,
      getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
      resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
      virtualWindow: runtime.virtualWindow,
      captureFocusAnchor,
      restoreFocusAnchor,
      restoreFocus,
      start: runtime.start,
      stop: runtime.stop,
    })

    return (): VNode => h(
      "div",
      mergeProps(attrs, {
        ref: rootElementRef,
        class: [
          "affino-datagrid-app-root",
          props.theme === "sugar" ? "affino-datagrid-app-root--theme-sugar" : null,
          props.layoutMode === "auto-height"
            ? "affino-datagrid-app-root--auto-height"
            : "affino-datagrid-app-root--fill",
        ],
        style: {
          display: "flex",
          width: "100%",
          minHeight: "0",
          minWidth: "0",
        },
      }),
      slots.default?.({
        api: runtime.api,
        core: runtime.core,
        runtime: publicRuntime,
        grid: publicRuntime,
        rowModel: runtime.rowModel,
        columnModel: runtime.columnModel,
        columnSnapshot: runtime.columnSnapshot.value,
        rowPartition: runtime.rowPartition.value,
        setRows: runtime.setRows,
        syncBodyRowsInRange: runtime.syncBodyRowsInRange,
        getBodyRowAtIndex: bodyRuntime.getBodyRowAtIndex,
        resolveBodyRowIndexById: bodyRuntime.resolveBodyRowIndexById,
        virtualWindow: slotVirtualWindow.value,
      }) ?? [],
    )
  },
})
