import { computed, nextTick, onBeforeUnmount, ref, watch, type ComputedRef } from "vue"
import type { UiTableColumn } from "@affino/datagrid-core/types"
import { getColumnCellElements } from "@affino/datagrid-core/dom/getCellElementsByRange"
import { measureBodyCellWidth, measureHeaderWidth } from "../core/columns/measurement"
import { scheduleMeasurement, type MeasurementHandle } from "@affino/datagrid-core/runtime/measurementQueue"
import { useFloatingPopover, usePopoverController } from "@affino/popover-vue"

type ColumnSortDirection = "asc" | "desc"

interface ColumnHeaderMenuBindings {
  close: () => void
  col: UiTableColumn
  sortDirection: ColumnSortDirection | null
}

interface UseColumnHeaderInteractionsOptions {
  column: ComputedRef<UiTableColumn>
  isMenuDisabled: ComputedRef<boolean>
  sortDirection: ComputedRef<ColumnSortDirection | null>
  zoomScale: ComputedRef<number>
  tableContainer: () => HTMLElement | null
  externalMenuOpen: ComputedRef<boolean>
  emitResize: (columnKey: string, width: number) => void
  emitSelect: (event: MouseEvent | KeyboardEvent) => void
  emitMenuOpen: (close: () => void) => void
  emitMenuClose: () => void
  hideColumn?: (columnKey: string) => void
}

const POPOVER_MARGIN = 4
const VIEWPORT_PADDING = 8

export function useColumnHeaderInteractions(options: UseColumnHeaderInteractionsOptions) {
  const popoverController = usePopoverController({
    id: `datagrid-column-menu-${Math.random().toString(36).slice(2, 10)}`,
    role: "menu",
    modal: false,
    closeOnEscape: true,
    closeOnInteractOutside: true,
  })
  const floatingPopover = useFloatingPopover(popoverController, {
    placement: "bottom",
    align: "end",
    gutter: POPOVER_MARGIN,
    viewportPadding: VIEWPORT_PADDING,
    teleportTo: "body",
    zIndex: 200,
    returnFocus: false,
    lockScroll: false,
  })

  const isMenuOpen = computed(() => popoverController.state.value.open)
  const headerCellRef = ref<HTMLElement | null>(null)
  const popoverPanelStyle = computed(() => floatingPopover.contentStyle.value)
  const popoverTeleportTarget = computed(() => floatingPopover.teleportTarget.value ?? "body")
  let suppressOpenSyncEmit = false
  let suppressCloseSyncEmit = false

  let startWidth = 0
  let resizeZoomScale = 1
  let isPointerResizing = false
  let resizeReleaseTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingAutoResizeRaf: number | null = null
  let pendingAutoResizeMeasure: MeasurementHandle<number> | null = null
  let autoResizeToken = 0
  let indicatorElement: HTMLDivElement | null = null
  let indicatorStartX = 0
  let columnStartX = 0
  let currentClientX = 0
  let containerScrollHandler: ((event: Event) => void) | null = null
  let activeContainer: HTMLElement | null = null
  let pendingIndicatorMeasure: MeasurementHandle<{
    rect: DOMRect
    scrollLeft: number
    scrollTop: number
    clientHeight: number
  } | null> | null = null
  let indicatorMeasureToken = 0

  function cancelIndicatorMeasurement() {
    if (pendingIndicatorMeasure) {
      pendingIndicatorMeasure.cancel()
      pendingIndicatorMeasure = null
    }
  }

  function updateIndicatorVerticalBounds(metrics: { scrollTop: number; clientHeight: number }) {
    if (!indicatorElement) return
    indicatorElement.style.bottom = "auto"
    indicatorElement.style.top = `${metrics.scrollTop}px`
    indicatorElement.style.height = `${metrics.clientHeight}px`
  }

  function createResizeIndicator(container: HTMLElement): HTMLDivElement {
    const indicator = document.createElement("div")
    indicator.className = "ui-table__resize-indicator"
    container.appendChild(indicator)
    return indicator
  }

  function removeResizeIndicator() {
    if (containerScrollHandler && activeContainer) {
      activeContainer.removeEventListener("scroll", containerScrollHandler)
    }
    containerScrollHandler = null
    activeContainer = null
    if (indicatorElement?.parentNode) {
      indicatorElement.parentNode.removeChild(indicatorElement)
    }
    indicatorElement = null
    cancelIndicatorMeasurement()
    indicatorMeasureToken = 0
  }

  function positionIndicator(clientX: number) {
    currentClientX = clientX
    if (!indicatorElement || !activeContainer) return
    scheduleIndicatorMeasurement(activeContainer)
  }

  function scheduleIndicatorMeasurement(container: HTMLElement) {
    const token = ++indicatorMeasureToken
    cancelIndicatorMeasurement()
    const handle = scheduleMeasurement(() => {
      if (!container.isConnected) {
        return null
      }
      const rect = container.getBoundingClientRect()
      return {
        rect,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
      }
    })

    pendingIndicatorMeasure = handle
    void handle.promise
      .then(result => {
        if (pendingIndicatorMeasure !== handle || indicatorMeasureToken !== token) {
          return
        }
        pendingIndicatorMeasure = null
        if (!result || !indicatorElement || !activeContainer || activeContainer !== container) {
          return
        }

        const { rect, scrollLeft, scrollTop, clientHeight } = result
        const clampedX = Math.max(rect.left, Math.min(currentClientX, rect.right))
        const offset = clampedX - rect.left + scrollLeft
        updateIndicatorVerticalBounds({ scrollTop, clientHeight })
        indicatorElement.style.left = `${Math.round(offset)}px`
      })
      .catch(() => {
        if (pendingIndicatorMeasure === handle) {
          pendingIndicatorMeasure = null
        }
      })
  }

  function setMenuButtonElement(element: HTMLElement | null) {
    floatingPopover.triggerRef.value = element
  }

  function setPopoverPanelElement(element: HTMLElement | null) {
    floatingPopover.contentRef.value = element
  }

  function setHeaderCellElement(element: HTMLElement | null) {
    headerCellRef.value = element
  }

  function cancelResizeReleaseTimeout() {
    if (resizeReleaseTimeout != null) {
      clearTimeout(resizeReleaseTimeout)
      resizeReleaseTimeout = null
    }
  }

  function closeMenu(emitEvent = true) {
    if (!isMenuOpen.value) return
    suppressCloseSyncEmit = !emitEvent
    void popoverController.close("programmatic")
  }

  function openMenu(emitEvent = true) {
    if (options.isMenuDisabled.value) return
    if (isPointerResizing) return
    if (isMenuOpen.value) return
    suppressOpenSyncEmit = !emitEvent
    popoverController.open("programmatic")
    void nextTick(() => floatingPopover.updatePosition())
  }

  function toggleMenu() {
    if (options.isMenuDisabled.value) return
    if (isPointerResizing) return
    if (isMenuOpen.value) {
      closeMenu()
    } else {
      openMenu()
    }
  }

  function onHeaderClick(event: MouseEvent | KeyboardEvent) {
    const isOnHandle = (event.target as HTMLElement | null)?.closest?.(".ui-table-column-resize")
    if (isOnHandle || isPointerResizing) return
    options.emitSelect(event)
  }

  function onHeaderKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onHeaderClick(event)
      return
    }
    if (event.key === "ArrowDown" && event.altKey) {
      if (options.isMenuDisabled.value) return
      event.preventDefault()
      openMenu()
      return
    }
    if (event.key === "Escape" && isMenuOpen.value) {
      event.preventDefault()
      closeMenu()
    }
  }

  function finalizeResize(event?: MouseEvent) {
  const column = options.column.value
    const container = activeContainer ?? options.tableContainer()
    if (!container) {
      options.emitResize(column.key, startWidth)
      return
    }
    const rect = container.getBoundingClientRect()
    const clientX = event?.clientX ?? currentClientX
    const clampedX = Math.max(rect.left, Math.min(clientX, rect.right))
    const deltaClient = clampedX - indicatorStartX
    const sizeDelta = deltaClient / resizeZoomScale
    const rawWidth = startWidth + sizeDelta
    const columnMin = column.minWidth ?? 10
    const columnMax = column.maxWidth ?? Number.POSITIVE_INFINITY
    const normalizedWidth = Math.round(Math.max(columnMin, Math.min(columnMax, rawWidth)))
    const shouldHide = clampedX < columnStartX
    if (shouldHide && !column.isSystem && typeof options.hideColumn === "function") {
      options.hideColumn(column.key)
    } else {
      options.emitResize(column.key, normalizedWidth)
    }
  }

  function stopResize(event?: MouseEvent) {
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    document.body.classList.remove("ui-table-resize-active")
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", stopResize)
    document.removeEventListener("mousemove", onMove)
    document.removeEventListener("mouseup", stopResize)
    if (!isPointerResizing) {
      removeResizeIndicator()
      return
    }
    finalizeResize(event)
    removeResizeIndicator()
    cancelResizeReleaseTimeout()
    resizeReleaseTimeout = setTimeout(() => {
      isPointerResizing = false
      resizeReleaseTimeout = null
    }, 0)
  }

  function onMove(event: MouseEvent) {
    if (!indicatorElement) {
      return
    }
    positionIndicator(event.clientX)
  }

  function startResize(event: MouseEvent) {
    cancelResizeReleaseTimeout()
    isPointerResizing = true
    event.preventDefault()
    event.stopPropagation()
    const zoom = options.zoomScale.value || 1
    startWidth = options.column.value.width ?? 120
    resizeZoomScale = zoom
    const container = options.tableContainer()
    activeContainer = container
    if (container) {
      const columnRect = headerCellRef.value?.getBoundingClientRect()
      if (columnRect) {
        columnStartX = columnRect.left
        indicatorStartX = columnRect.right
      } else {
        const containerRect = container.getBoundingClientRect()
        columnStartX = containerRect.left
        indicatorStartX = containerRect.left + startWidth * zoom
      }
      indicatorElement = createResizeIndicator(container)
      if (indicatorElement) {
        positionIndicator(indicatorStartX)
        containerScrollHandler = () => {
          if (!activeContainer) return
          positionIndicator(currentClientX)
        }
        container.addEventListener("scroll", containerScrollHandler)
      }
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.body.classList.add("ui-table-resize-active")
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", stopResize)
  }

  function autoResize() {
    const header = headerCellRef.value
    if (!header) return

    const container = options.tableContainer()
    const column = options.column.value
    const zoom = options.zoomScale.value || 1
    const minWidth = column.minWidth ?? 10
    const maxWidthConstraint = column.maxWidth ?? Number.POSITIVE_INFINITY

    const columnElements = container ? getColumnCellElements(container, column.key) : []
    const uniqueElements = Array.from(new Set(columnElements)) as HTMLElement[]
    if (!uniqueElements.includes(header)) {
      uniqueElements.push(header)
    }

    const token = ++autoResizeToken

    if (pendingAutoResizeMeasure) {
      pendingAutoResizeMeasure.cancel()
      pendingAutoResizeMeasure = null
    }

    const measureHandle = scheduleMeasurement(() => {
      const measurementCandidates = uniqueElements.map(element => {
        if (!(element instanceof HTMLElement)) return 0
        return element === header || element.classList.contains("ui-table-header-cell")
          ? measureHeaderWidth(element)
          : measureBodyCellWidth(element)
      })

      const maxWidth = measurementCandidates.reduce((max, candidate) => {
        if (Number.isFinite(candidate)) {
          return Math.max(max, candidate)
        }
        return max
      }, 0)

      const normalizedWidth = maxWidth / zoom
      const clampedWidth = Math.min(maxWidthConstraint, Math.max(minWidth, Math.ceil(normalizedWidth)))
      return Number.isFinite(clampedWidth) ? clampedWidth : minWidth
    })

    pendingAutoResizeMeasure = measureHandle

    measureHandle.promise
      .then(newWidth => {
        if (token !== autoResizeToken) return

        if (pendingAutoResizeRaf !== null) {
          cancelAnimationFrame(pendingAutoResizeRaf)
          pendingAutoResizeRaf = null
        }

        pendingAutoResizeRaf = requestAnimationFrame(() => {
          if (token !== autoResizeToken) return
          options.emitResize(column.key, newWidth)
          pendingAutoResizeRaf = null
        })
      })
      .catch(() => {
        /* ignore measurement errors */
      })
      .finally(() => {
        if (pendingAutoResizeMeasure === measureHandle) {
          pendingAutoResizeMeasure = null
        }
      })
  }

  const menuSlotBindings = computed<ColumnHeaderMenuBindings>(() => ({
    close: () => closeMenu(),
    col: options.column.value,
    sortDirection: options.sortDirection.value,
  }))

  watch(options.externalMenuOpen, value => {
    if (value && !isMenuOpen.value) {
      openMenu(false)
    } else if (!value && isMenuOpen.value) {
      closeMenu(false)
    }
  })

  watch(
    () => popoverController.state.value.open,
    (open, previous) => {
      if (open) {
        void nextTick(() => floatingPopover.updatePosition())
        if (suppressOpenSyncEmit) {
          suppressOpenSyncEmit = false
        } else {
          options.emitMenuOpen(() => closeMenu())
        }
        return
      }

      if (!previous) {
        return
      }
      if (suppressCloseSyncEmit) {
        suppressCloseSyncEmit = false
      } else {
        options.emitMenuClose()
      }
    },
  )

  onBeforeUnmount(() => {
    cancelResizeReleaseTimeout()
    stopResize()
    if (pendingAutoResizeRaf !== null) {
      cancelAnimationFrame(pendingAutoResizeRaf)
      pendingAutoResizeRaf = null
    }
    if (pendingAutoResizeMeasure) {
      pendingAutoResizeMeasure.cancel()
      pendingAutoResizeMeasure = null
    }
    popoverController.dispose()
  })

  return {
    isMenuOpen,
    popoverPanelStyle,
    popoverTeleportTarget,
    setMenuButtonElement,
    setPopoverPanelElement,
    setHeaderCellElement,
    toggleMenu,
    openMenu,
    closeMenu,
    onHeaderClick,
    onHeaderKeydown,
    startResize,
    autoResize,
    menuSlotBindings,
  }
}
