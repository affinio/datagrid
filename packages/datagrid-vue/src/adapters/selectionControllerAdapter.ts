import { onScopeDispose, shallowRef } from "vue"
import type { ShallowRef } from "vue"
import type { SelectionController, SelectionControllerListener } from "@affino/datagrid-core/selection/headlessSelectionController"
import type {
	SelectionEnvironment,
	SelectionOverlaySnapshot,
	SelectionRange,
} from "@affino/datagrid-core/selection/selectionEnvironment"
import type { GridSelectionContext } from "@affino/datagrid-core/selection/selectionState"
import type { HeadlessSelectionState } from "@affino/datagrid-core/selection/update"
import type { PointerCoordinates } from "@affino/datagrid-core/selection/autoScroll"
import type { AdapterLifecycle } from "./adapterLifecycle"
import {
	createSelectionHeadlessAdapter,
	type SelectionHeadlessAdapterDiagnostics,
	type SelectionHeadlessAdapterSyncInput,
} from "./selectionHeadlessAdapter"

export interface SelectionControllerAdapterOptions<RowKey> {
	environment: SelectionEnvironment<RowKey>
	context: GridSelectionContext<RowKey>
	initialState?: HeadlessSelectionState<RowKey>
}

export interface SelectionControllerAdapter<RowKey> {
	controller: SelectionController<RowKey>
	state: ShallowRef<HeadlessSelectionState<RowKey>>
	overlaySnapshot: ShallowRef<SelectionOverlaySnapshot | null>
	fillHandleRange: ShallowRef<SelectionRange<RowKey> | null>
	autoscrollState: ShallowRef<{ active: boolean; pointer: PointerCoordinates | null }>
	subscribe(listener: SelectionControllerListener<RowKey>): () => void
	init(): void
	sync(input: SelectionHeadlessAdapterSyncInput<RowKey>): void
	teardown(): void
	diagnostics(): SelectionHeadlessAdapterDiagnostics
	dispose(): void
}

export function createSelectionControllerAdapter<RowKey>(
	options: SelectionControllerAdapterOptions<RowKey>,
): SelectionControllerAdapter<RowKey> {
	const headlessAdapter = createSelectionHeadlessAdapter<RowKey>(options)
	const initialSnapshot = headlessAdapter.snapshot()
	const state = shallowRef(initialSnapshot.state)
	const overlaySnapshot = shallowRef<SelectionOverlaySnapshot | null>(initialSnapshot.overlaySnapshot)
	const fillHandleRange = shallowRef<SelectionRange<RowKey> | null>(initialSnapshot.fillHandleRange)
	const autoscrollState = shallowRef(initialSnapshot.autoscrollState)

	const listeners = new Set<SelectionControllerListener<RowKey>>()
	let disposed = false

	const syncRefsFromSnapshot = () => {
		const snapshot = headlessAdapter.snapshot()
		state.value = snapshot.state
		overlaySnapshot.value = snapshot.overlaySnapshot
		fillHandleRange.value = snapshot.fillHandleRange
		autoscrollState.value = snapshot.autoscrollState
	}

	const controllerUnsubscribe = headlessAdapter.subscribe(event => {
		if (disposed) {
			return
		}

		syncRefsFromSnapshot()

		if (listeners.size) {
			for (const listener of listeners) {
				listener(event)
			}
		}
	})

	const subscribe = (listener: SelectionControllerListener<RowKey>) => {
		if (disposed) {
			return () => {}
		}
		listeners.add(listener)
		return () => {
			listeners.delete(listener)
		}
	}

	const init: AdapterLifecycle<
		SelectionControllerAdapterOptions<RowKey>,
		SelectionHeadlessAdapterSyncInput<RowKey>,
		SelectionHeadlessAdapterDiagnostics
	>["init"] = () => {
		headlessAdapter.init()
		syncRefsFromSnapshot()
	}

	const sync: AdapterLifecycle<
		SelectionControllerAdapterOptions<RowKey>,
		SelectionHeadlessAdapterSyncInput<RowKey>,
		SelectionHeadlessAdapterDiagnostics
	>["sync"] = input => {
		headlessAdapter.sync(input)
		syncRefsFromSnapshot()
	}

	const teardown: AdapterLifecycle<
		SelectionControllerAdapterOptions<RowKey>,
		SelectionHeadlessAdapterSyncInput<RowKey>,
		SelectionHeadlessAdapterDiagnostics
	>["teardown"] = () => {
		headlessAdapter.teardown()
		syncRefsFromSnapshot()
	}

	const diagnostics: AdapterLifecycle<
		SelectionControllerAdapterOptions<RowKey>,
		SelectionHeadlessAdapterSyncInput<RowKey>,
		SelectionHeadlessAdapterDiagnostics
	>["diagnostics"] = () => headlessAdapter.diagnostics()

	const dispose = () => {
		if (disposed) {
			return
		}
		disposed = true
		controllerUnsubscribe()
		listeners.clear()
		teardown()
	}

	onScopeDispose(dispose)

	return {
		get controller() {
			return headlessAdapter.controller
		},
		state,
		overlaySnapshot,
		fillHandleRange,
		autoscrollState,
		subscribe,
		init,
		sync,
		teardown,
		diagnostics,
		dispose,
	}
}
