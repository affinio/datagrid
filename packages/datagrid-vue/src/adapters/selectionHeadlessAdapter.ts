import {
  createSelectionController,
  type SelectionController,
  type SelectionControllerListener,
  type SelectionControllerOptions,
} from "@affino/datagrid-core/selection/headlessSelectionController"
import type { SelectionOverlaySnapshot, SelectionRange, SelectionPoint } from "@affino/datagrid-core/selection/selectionEnvironment"
import type { GridSelectionRange } from "@affino/datagrid-core/selection/selectionState"
import {
  emptySelectionState,
  type HeadlessSelectionState,
} from "@affino/datagrid-core/selection/update"
import type { PointerCoordinates } from "@affino/datagrid-core/selection/autoScroll"
import type { AdapterLifecycle, AdapterDiagnostics } from "./adapterLifecycle"

export interface SelectionHeadlessAdapterOptions<RowKey> extends SelectionControllerOptions<RowKey> {}

export interface SelectionHeadlessAdapterSyncInput<RowKey> {
  state?: HeadlessSelectionState<RowKey>
  ranges?: {
    ranges: readonly GridSelectionRange<RowKey>[]
    activeRangeIndex?: number
  }
  focusPoint?: SelectionPoint<RowKey>
  extendPoint?: SelectionPoint<RowKey>
  togglePoint?: SelectionPoint<RowKey>
  clearSelection?: boolean
  overlaySnapshot?: SelectionOverlaySnapshot
  fillHandleRange?: SelectionRange<RowKey> | null
  autoscroll?: {
    active: boolean
    pointer?: PointerCoordinates | null
  }
}

export interface SelectionHeadlessAdapterSnapshot<RowKey> {
  state: HeadlessSelectionState<RowKey>
  overlaySnapshot: SelectionOverlaySnapshot | null
  fillHandleRange: SelectionRange<RowKey> | null
  autoscrollState: {
    active: boolean
    pointer: PointerCoordinates | null
  }
}

export interface SelectionHeadlessAdapterDiagnostics extends AdapterDiagnostics {
  initCount: number
  teardownCount: number
  listenerCount: number
  eventCount: number
  lastEventType: string | null
}

export interface SelectionHeadlessAdapter<RowKey>
  extends AdapterLifecycle<
    SelectionHeadlessAdapterOptions<RowKey>,
    SelectionHeadlessAdapterSyncInput<RowKey>,
    SelectionHeadlessAdapterDiagnostics
  > {
  readonly controller: SelectionController<RowKey>
  subscribe(listener: SelectionControllerListener<RowKey>): () => void
  snapshot(): SelectionHeadlessAdapterSnapshot<RowKey>
}

function cloneState<RowKey>(state: HeadlessSelectionState<RowKey>): HeadlessSelectionState<RowKey> {
  return {
    ranges: state.ranges,
    areas: state.areas,
    activeRangeIndex: state.activeRangeIndex,
    selectedPoint: state.selectedPoint,
    anchorPoint: state.anchorPoint,
    dragAnchorPoint: state.dragAnchorPoint,
  }
}

export function createSelectionHeadlessAdapter<RowKey>(
  options: SelectionHeadlessAdapterOptions<RowKey>,
): SelectionHeadlessAdapter<RowKey> {
  let currentOptions = options
  let controller: SelectionController<RowKey> | null = null
  let controllerUnsubscribe: (() => void) | null = null
  const listeners = new Set<SelectionControllerListener<RowKey>>()

  const state = {
    value: emptySelectionState<RowKey>(),
    overlaySnapshot: null as SelectionOverlaySnapshot | null,
    fillHandleRange: null as SelectionRange<RowKey> | null,
    autoscrollState: {
      active: false,
      pointer: null as PointerCoordinates | null,
    },
  }

  const diagnosticsState: SelectionHeadlessAdapterDiagnostics = {
    initialized: false,
    disposed: false,
    syncCount: 0,
    initCount: 0,
    teardownCount: 0,
    listenerCount: 0,
    eventCount: 0,
    lastEventType: null,
  }

  const notify = (event: Parameters<SelectionControllerListener<RowKey>>[0]) => {
    diagnosticsState.eventCount += 1
    diagnosticsState.lastEventType = event.type
    if (event.type === "selection-change") {
      state.value = cloneState(event.state)
    } else if (event.type === "overlay-update") {
      state.overlaySnapshot = event.snapshot
    } else if (event.type === "fill-handle-change") {
      state.fillHandleRange = event.range
    } else if (event.type === "autoscroll") {
      state.autoscrollState = event.active
        ? { active: true, pointer: event.pointer }
        : { active: false, pointer: null }
    }

    for (const listener of listeners) {
      listener(event)
    }
  }

  const ensureController = (): SelectionController<RowKey> => {
    if (!controller) {
      throw new Error("SelectionHeadlessAdapter is not initialized")
    }
    return controller
  }

  const init = (nextOptions?: SelectionHeadlessAdapterOptions<RowKey>) => {
    if (nextOptions) {
      currentOptions = nextOptions
    }
    if (controller) {
      return
    }

    controller = createSelectionController<RowKey>(currentOptions)
    state.value = cloneState(controller.getState())
    controllerUnsubscribe = controller.subscribe(notify)
    diagnosticsState.initialized = true
    diagnosticsState.disposed = false
    diagnosticsState.initCount += 1
  }

  const sync = (input: SelectionHeadlessAdapterSyncInput<RowKey>) => {
    const activeController = ensureController()
    diagnosticsState.syncCount += 1

    if (input.state) {
      activeController.setState(input.state)
    }
    if (input.ranges) {
      activeController.updateRanges(input.ranges.ranges, input.ranges.activeRangeIndex)
    }
    if (input.focusPoint) {
      activeController.focusCell(input.focusPoint)
    }
    if (input.extendPoint) {
      activeController.extendSelection(input.extendPoint)
    }
    if (input.togglePoint) {
      activeController.toggleCell(input.togglePoint)
    }
    if (input.clearSelection) {
      activeController.clearSelection()
    }
    if (input.overlaySnapshot) {
      activeController.commitOverlaySnapshot(input.overlaySnapshot)
    }
    if (input.fillHandleRange !== undefined) {
      activeController.updateFillHandleRange(input.fillHandleRange)
    }
    if (input.autoscroll) {
      if (input.autoscroll.active) {
        activeController.triggerAutoscroll(input.autoscroll.pointer ?? { clientX: 0, clientY: 0 })
      } else {
        activeController.stopAutoscroll()
      }
    }
  }

  const teardown = () => {
    if (!controller) {
      return
    }
    controllerUnsubscribe?.()
    controllerUnsubscribe = null
    controller.dispose()
    controller = null
    state.value = emptySelectionState<RowKey>()
    state.overlaySnapshot = null
    state.fillHandleRange = null
    state.autoscrollState = { active: false, pointer: null }
    diagnosticsState.initialized = false
    diagnosticsState.disposed = true
    diagnosticsState.teardownCount += 1
  }

  const diagnostics = (): SelectionHeadlessAdapterDiagnostics => ({
    ...diagnosticsState,
    listenerCount: listeners.size,
  })

  const subscribe = (listener: SelectionControllerListener<RowKey>) => {
    listeners.add(listener)
    diagnosticsState.listenerCount = listeners.size
    return () => {
      listeners.delete(listener)
      diagnosticsState.listenerCount = listeners.size
    }
  }

  const snapshot = (): SelectionHeadlessAdapterSnapshot<RowKey> => ({
    state: cloneState(state.value),
    overlaySnapshot: state.overlaySnapshot,
    fillHandleRange: state.fillHandleRange,
    autoscrollState: { ...state.autoscrollState },
  })

  init(currentOptions)

  return {
    get controller() {
      return ensureController()
    },
    init,
    sync,
    teardown,
    diagnostics,
    subscribe,
    snapshot,
  }
}
