import {
	createWritableSignal,
	type CreateWritableSignal,
	type WritableSignal,
} from "../runtime/signals"

import { createFrameScheduler, type FrameSchedulerHooks } from "../runtime/frameScheduler"
import { createRafScheduler } from "../runtime/rafScheduler"
import { flushMeasurements } from "../runtime/measurementQueue"
import type { DataGridViewportResizeObserver } from "./viewportHostEnvironment"

import type { DataGridColumn, VisibleRow } from "../types"
import {
	createClientRowModel,
	createDataGridColumnModel,
	type DataGridColumnModel,
	type DataGridRowModel,
	type DataGridViewportRange,
} from "../models"
import { BASE_ROW_HEIGHT, clamp } from "../utils/constants"
import {
	resolveColumnWidth as resolveColumnWidthDefault,
	supportsCssZoom,
} from "../dom/gridUtils"
import { createHorizontalOverscanController } from "../virtualization/dynamicOverscan"
import {
	updateColumnSnapshot,
	createEmptyColumnSnapshot,
} from "../virtualization/columnSnapshot"
import {
	createAxisVirtualizer,
	type AxisVirtualizerState,
} from "../virtualization/axisVirtualizer"
import {
	createHorizontalAxisStrategy,
	type HorizontalVirtualizerPayload,
} from "../virtualization/horizontalVirtualizer"
import {
	createDataGridViewportSignals,
	type DataGridViewportSignals,
} from "./dataGridViewportSignals"
import { createDataGridViewportDiagnostics } from "./dataGridViewportDiagnostics"
import {
	createDataGridViewportScrollIo,
	type DataGridViewportScrollStateAdapter,
} from "./dataGridViewportScrollIo"
import { createDataGridViewportVirtualization } from "./dataGridViewportVirtualization"
import {
	buildHorizontalMeta,
	type DataGridViewportHorizontalMeta,
} from "./dataGridViewportHorizontalMeta"
import {
	applyHorizontalViewport,
	prepareHorizontalViewport,
	type HorizontalUpdateCallbacks,
	type HorizontalUpdatePrepared,
} from "./dataGridViewportHorizontalUpdate"
import type {
	ViewportMetricsSnapshot,
	LayoutMeasurementSnapshot,
	DataGridViewportImperativeCallbacks,
	DataGridViewportControllerOptions,
	ViewportIntegrationSnapshot,
	ViewportSyncTargets,
} from "./dataGridViewportTypes"
import type { ViewportSyncState } from "./dataGridViewportTypes"
import type { ColumnPinMode } from "../virtualization/types"
import { resolveCanonicalPinMode } from "../columns/pinning"
import {
	clampHorizontalOffset,
	type HorizontalClampContext,
} from "./dataGridViewportHorizontalClamp"

export type {
	ViewportMetricsSnapshot,
	LayoutMeasurementSnapshot,
	ImperativeColumnUpdatePayload,
	ImperativeRowUpdatePayload,
	ImperativeScrollSyncPayload,
	DataGridViewportImperativeCallbacks,
	DataGridViewportControllerOptions,
	DataGridViewportRuntimeOverrides,
	ViewportIntegrationSnapshot,
	ViewportSyncTargets,
	ViewportSyncState,
} from "./dataGridViewportTypes"
import {
	createDefaultHostEnvironment,
	createMonotonicClock,
	type ViewportClock,
} from "./dataGridViewportConfig"
import {
	createLayoutMeasurementCache,
	type LayoutMeasurementCache,
} from "./dataGridViewportLayoutCache"
import {
	FRAME_BUDGET_CONSTANTS,
	HORIZONTAL_VIRTUALIZATION_CONSTANTS,
	VERTICAL_VIRTUALIZATION_CONSTANTS,
} from "./dataGridViewportConstants"
import {
	sampleBoundingRect,
	sampleContainerMetrics,
	sampleHeaderHeight,
	resolveDomStats,
} from "./dataGridViewportEnvironment"
import {
	computePinnedWidth,
	resolveHorizontalSizing,
	resolvePendingScroll,
	resolveViewportDimensions,
	shouldNotifyNearBottom,
	shouldUseFastPath,
} from "./dataGridViewportMath"
import { createDataGridViewportModelBridgeService } from "./dataGridViewportModelBridgeService"
import { createDataGridViewportRenderSyncService } from "./dataGridViewportRenderSyncService"
export type { DataGridViewportState, RowPoolItem } from "./dataGridViewportSignals"


export interface DataGridViewportController extends DataGridViewportSignals {
	attach(container: HTMLDivElement | null, header: HTMLElement | null): void
	detach(): void
	setRowModel(rowModel: DataGridRowModel<unknown> | null | undefined): void
	setColumnModel(columnModel: DataGridColumnModel | null | undefined): void
	setZoom(zoom: number): void
	setVirtualizationEnabled(enabled: boolean): void
	setRowHeightMode(mode: "fixed" | "auto"): void
	setBaseRowHeight(height: number): void
	setViewportMetrics(metrics: ViewportMetricsSnapshot | null): void
	setIsLoading(loading: boolean): void
	setImperativeCallbacks(callbacks: DataGridViewportImperativeCallbacks | null | undefined): void
	setOnAfterScroll(callback: (() => void) | null | undefined): void
	setOnNearBottom(callback: (() => void) | null | undefined): void
	setDebugMode(enabled: boolean): void
	handleScroll(event: Event): void
	updateViewportHeight(): void
	measureRowHeight(): void
	cancelScrollRaf(): void
	scrollToRow(index: number): void
	scrollToColumn(key: string): void
	isRowVisible(index: number): boolean
	clampScrollTopValue(value: number): number
	setViewportSyncTargets(targets: ViewportSyncTargets | null): void
	getViewportSyncState(): ViewportSyncState
	getIntegrationSnapshot(): ViewportIntegrationSnapshot
	refresh(force?: boolean): void
	dispose(): void
}


export function createDataGridViewportController(
	options: DataGridViewportControllerOptions,
): DataGridViewportController {
	const resolveColumnWidth = options.resolveColumnWidth ?? resolveColumnWidthDefault
	const getColumnKey = options.getColumnKey ?? ((column: DataGridColumn) => column.key)

	const fallbackResolvePinMode = (column: DataGridColumn): ColumnPinMode => resolveCanonicalPinMode(column)

	const resolvePinMode = (column: DataGridColumn): ColumnPinMode => {
		const userResolved = options.resolvePinMode ? options.resolvePinMode(column) : fallbackResolvePinMode(column)
		if (userResolved === "left" || userResolved === "right" || userResolved === "none") {
			return userResolved
		}
		return fallbackResolvePinMode(column)
	}

	const hostEnvironment = options.hostEnvironment ?? createDefaultHostEnvironment()
		const clock: ViewportClock = options.clock ?? createMonotonicClock()
		const frameBudget = options.frameBudget ?? FRAME_BUDGET_CONSTANTS
		const verticalVirtualization = options.verticalVirtualization ?? VERTICAL_VIRTUALIZATION_CONSTANTS
		const horizontalVirtualization = options.horizontalVirtualization ?? HORIZONTAL_VIRTUALIZATION_CONSTANTS
		const verticalScrollEpsilon = verticalVirtualization.scrollEpsilon
		const horizontalScrollEpsilon = horizontalVirtualization.scrollEpsilon
		const horizontalMinOverscan = Math.max(0, horizontalVirtualization.minOverscan)
	const runtimeOverrides = options.runtime ?? {}
	const scheduler =
		runtimeOverrides.rafScheduler ??
		(typeof runtimeOverrides.createRafScheduler === "function"
			? runtimeOverrides.createRafScheduler()
			: createRafScheduler())
	const ownsScheduler = !runtimeOverrides.rafScheduler
	const createFrameSchedulerFn = runtimeOverrides.createFrameScheduler ?? createFrameScheduler
	const flushMeasurementQueue = runtimeOverrides.measurementQueue?.flush ?? flushMeasurements

		const createSignal = <T,>(initial: T): WritableSignal<T> => {
			const factory = options.createSignal as CreateWritableSignal<T> | undefined
			if (factory) {
				return factory(initial)
			}
			return createWritableSignal(initial)
		}

		const signals = createDataGridViewportSignals(createSignal)
		const { input, core, derived, dispose: disposeSignals } = signals
		const {
			scrollTop,
			scrollLeft,
			viewportHeight,
			viewportWidth,
			virtualizationEnabled,
		} = input
		const {
			totalRowCount,
			effectiveRowHeight,
			totalContentHeight,
			startIndex,
			endIndex,
		} = core
		const {
			columns: {
				visibleColumns,
				visibleColumnEntries,
				visibleScrollableColumns,
				visibleScrollableEntries,
				pinnedLeftColumns,
				pinnedLeftEntries,
				pinnedRightColumns,
				pinnedRightEntries,
				leftPadding,
				rightPadding,
				columnWidthMap,
				visibleStartCol,
				visibleEndCol,
				scrollableRange,
				columnVirtualState,
			},
			metrics: {
				debugMode,
				fps,
				frameTime,
				droppedFrames,
				layoutReads,
				layoutWrites,
				syncScrollRate,
				heavyUpdateRate,
				virtualizerUpdates,
				virtualizerSkips,
			},
		} = derived

		const frameScheduler = createFrameSchedulerFn({
			onBeforeFrame: () => {
				if (!heavyFramePending && !heavyFrameInProgress) {
					return
				}
				frameForce = pendingForce
				pendingForce = false
			},
			onRead: () => {
				if (!heavyFramePending && !heavyFrameInProgress) {
					return
				}
				measureLayout()
			},
			onCommit: () => {
				if (!heavyFramePending && !heavyFrameInProgress) {
					frameForce = false
					return
				}
				runUpdate(frameForce)
				frameForce = false
			},
		} as FrameSchedulerHooks)

		const diagnostics = createDataGridViewportDiagnostics({
			scheduler,
			clock,
			signals: {
				debugMode,
				fps,
				frameTime,
				droppedFrames,
				layoutReads,
				layoutWrites,
				syncScrollRate,
				heavyUpdateRate,
				virtualizerUpdates,
				virtualizerSkips,
			},
		})

		const {
			recordLayoutRead,
			recordLayoutWrite,
			recordSyncScroll,
			recordHeavyPass,
			recordVirtualizerUpdate,
			recordVirtualizerSkip,
			setDebugMode: applyDebugMode,
			isDebugEnabled,
			dispose: disposeDiagnostics,
		} = diagnostics

		const virtualization = createDataGridViewportVirtualization({
			signals,
			diagnostics,
			clock,
			frameBudget,
			verticalConfig: verticalVirtualization,
		})

		const horizontalVirtualizer = createAxisVirtualizer(
			"horizontal",
			createHorizontalAxisStrategy<DataGridColumn>(),
			{
				visibleStart: 0,
				visibleEnd: 0,
				leftPadding: 0,
				rightPadding: 0,
				totalScrollableWidth: 0,
				visibleScrollableWidth: 0,
				averageWidth: 0,
				scrollSpeed: 0,
				effectiveViewport: 0,
			} satisfies HorizontalVirtualizerPayload,
		)

		const horizontalOverscanController = createHorizontalOverscanController({
			minOverscan: horizontalMinOverscan,
			velocityRatio: horizontalVirtualization.velocityOverscanRatio,
			viewportRatio: horizontalVirtualization.viewportOverscanRatio,
			decay: horizontalVirtualization.overscanDecay,
			maxViewportMultiplier: horizontalVirtualization.maxViewportMultiplier,
			teleportMultiplier: frameBudget.teleportMultiplier,
			frameDurationMs: frameBudget.frameDurationMs,
			minSampleMs: frameBudget.minVelocitySampleMs,
		})

		const columnSnapshot = createEmptyColumnSnapshot<DataGridColumn>()
		// Cache layout metrics from observers so the heavy path never touches the DOM.
		const layoutCache: LayoutMeasurementCache = createLayoutMeasurementCache()
		const fallbackClientRowModel = createClientRowModel<unknown>({ rows: [] })
		const fallbackColumnModel = createDataGridColumnModel({ columns: [] })
		let container: HTMLDivElement | null = null
		let header: HTMLElement | null = null
		let zoom = 1
		let virtualizationFlag = true
		let rowHeightMode: "fixed" | "auto" = "fixed"
		let baseRowHeight = BASE_ROW_HEIGHT
		let viewportMetrics: ViewportMetricsSnapshot | null = null
		let loading = false
		let imperativeCallbacks: DataGridViewportImperativeCallbacks = options.imperativeCallbacks ?? {}
		let lastImperativeScrollSyncSignature = ""
		let lastImperativeColumnSignature = ""
		let onAfterScroll = options.onAfterScroll ?? null
		let onNearBottom = options.onNearBottom ?? null

		let pendingScrollTop: number | null = null
		let pendingScrollLeft: number | null = null
		let afterScrollTaskId: number | null = null
		let pendingForce = false
		let frameForce = false
		let heavyFramePending = false
		let heavyFrameInProgress = false
		let heavyUpdateTaskId: number | null = null
		let pendingHorizontalSettle = false
		let horizontalOverscan = horizontalMinOverscan
		let resizeObserver: DataGridViewportResizeObserver | null = null
		let attached = false
		let lastScrollTopSample = 0
		let lastScrollLeftSample = 0
		let lastAppliedScrollTop = 0
		let driftCorrectionPending = false
		let lastHorizontalSampleTime = 0
		let smoothedHorizontalVelocity = 0
		let horizontalMetaVersion = 0
		let lastHorizontalMetaSignature = ""
		let lastAppliedHorizontalMetaVersion = -1
		let cachedContainerWidth = -1
		let cachedContainerHeight = -1
		let cachedHeaderHeight = -1
		let cachedNativeScrollHeight = -1
		let cachedNativeScrollWidth = -1
		let layoutMeasurement: LayoutMeasurementSnapshot | null = null
		let lastAppliedScrollLeft = 0
		let lastHeavyScrollTop = 0
		let lastHeavyScrollLeft = 0
		let lastAverageColumnWidth = 0
		let lastScrollDirection = 0
		let horizontalClampContext: HorizontalClampContext = {
			totalScrollableWidth: 0,
			containerWidthForColumns: 0,
			pinnedLeftWidth: 0,
			pinnedRightWidth: 0,
			averageColumnWidth: 1,
			nativeScrollLimit: 0,
			virtualizationEnabled: true,
		}
		const scrollSyncState: ViewportSyncState = {
			scrollLeft: 0,
			scrollTop: 0,
			pinnedOffsetLeft: 0,
			pinnedOffsetRight: 0,
		}
		const modelBridge = createDataGridViewportModelBridgeService({
			initialRowModel: options.rowModel ?? null,
			initialColumnModel: options.columnModel ?? null,
			fallbackRowModel: fallbackClientRowModel,
			fallbackColumnModel,
			onInvalidate: () => {
				scheduleUpdate(true)
			},
		})

		function measureLayout() {
			if (!attached) {
				layoutMeasurement = null
				return
			}
			layoutMeasurement = layoutCache.snapshot()
		}

		function captureLayoutMetrics(label: "attach" | "resize" | "manual"): boolean {
			// All DOM reads stay confined to observer-driven phases.
			if (!container) {
				return false
			}
			const previousContainerHeight = cachedContainerHeight
			const previousContainerWidth = cachedContainerWidth
			const previousHeaderHeight = cachedHeaderHeight
			const previousNativeScrollHeight = cachedNativeScrollHeight
			const previousNativeScrollWidth = cachedNativeScrollWidth
			flushMeasurementQueue()
			const containerMetrics = sampleContainerMetrics(hostEnvironment, recordLayoutRead, container)
			const rect = sampleBoundingRect(hostEnvironment, recordLayoutRead, container)
			layoutCache.updateContainer(containerMetrics, rect)
			cachedContainerHeight = containerMetrics.clientHeight > 0 ? containerMetrics.clientHeight : cachedContainerHeight
			cachedContainerWidth = containerMetrics.clientWidth > 0 ? containerMetrics.clientWidth : cachedContainerWidth
			cachedNativeScrollHeight = containerMetrics.scrollHeight
			cachedNativeScrollWidth = containerMetrics.scrollWidth
			if (header) {
				const headerHeightValue = sampleHeaderHeight(hostEnvironment, recordLayoutRead, header)
				layoutCache.updateHeader({ height: headerHeightValue })
				if (headerHeightValue > 0) {
					cachedHeaderHeight = headerHeightValue
				}
			} else {
				layoutCache.updateHeader({ height: 0 })
				cachedHeaderHeight = 0
			}
			if (label !== "manual") {
				measureLayout()
			}
			return (
				Math.abs(cachedContainerHeight - previousContainerHeight) > 0.5 ||
				Math.abs(cachedContainerWidth - previousContainerWidth) > 0.5 ||
				Math.abs(cachedHeaderHeight - previousHeaderHeight) > 0.5 ||
				Math.abs(cachedNativeScrollHeight - previousNativeScrollHeight) > 0.5 ||
				Math.abs(cachedNativeScrollWidth - previousNativeScrollWidth) > 0.5
			)
		}

		function cancelPendingHeavyUpdate() {
			if (heavyUpdateTaskId === null) {
				return
			}
			scheduler.cancel(heavyUpdateTaskId)
			heavyUpdateTaskId = null
		}

		function requestHeavyFrame(force: boolean) {
			if (heavyFrameInProgress) {
				heavyFramePending = true
				frameScheduler.invalidate()
				return
			}
			if (!heavyFramePending) {
				heavyFramePending = true
				frameScheduler.invalidate()
				return
			}
			if (force) {
				frameScheduler.invalidate()
			}
		}

		function scheduleUpdate(force = false) {
			pendingForce = pendingForce || force

			if (force) {
				cancelPendingHeavyUpdate()
				requestHeavyFrame(true)
				return
			}

			if (heavyFrameInProgress) {
				requestHeavyFrame(false)
				return
			}

			if (heavyFramePending) {
				return
			}

			if (heavyUpdateTaskId !== null) {
				return
			}

			const taskId = scheduler.schedule(() => {
				heavyUpdateTaskId = null
				requestHeavyFrame(false)
			}, { priority: "normal" })

			if (taskId >= 0) {
				heavyUpdateTaskId = taskId
				return
			}

			requestHeavyFrame(false)
		}

		function flushSchedulers() {
			flushMeasurementQueue()
			frameScheduler.flush()
			scheduler.flush()
		}

		function updateCachedScrollOffsets(scrollTopValue: number, scrollLeftValue: number) {
			const metrics = {
				clientWidth: cachedContainerWidth >= 0 ? cachedContainerWidth : 0,
				clientHeight: cachedContainerHeight >= 0 ? cachedContainerHeight : 0,
				scrollWidth: cachedNativeScrollWidth >= 0 ? cachedNativeScrollWidth : 0,
				scrollHeight: cachedNativeScrollHeight >= 0 ? cachedNativeScrollHeight : 0,
				scrollTop: scrollTopValue,
				scrollLeft: scrollLeftValue,
			}
			layoutCache.updateContainer(metrics, null)
			lastScrollTopSample = scrollTopValue
			lastScrollLeftSample = scrollLeftValue
		}

		function emitImperativeScrollSync(scrollTopValue: number, scrollLeftValue: number, timestamp?: number) {
			if (typeof imperativeCallbacks.onScrollSync !== "function") {
				return
			}
			const signature = `${Math.round(scrollTopValue * 1000)}|${Math.round(scrollLeftValue * 1000)}`
			if (signature === lastImperativeScrollSyncSignature) {
				return
			}
			lastImperativeScrollSyncSignature = signature
			const resolvedTs = Number.isFinite(timestamp) ? (timestamp as number) : clock.now()
			imperativeCallbacks.onScrollSync({
				scrollTop: scrollTopValue,
				scrollLeft: scrollLeftValue,
				timestamp: resolvedTs,
			})
		}

		let scrollSyncTaskId: number | null = null

		const scrollState: DataGridViewportScrollStateAdapter = {
			getContainer: () => container,
			setContainer: value => {
				container = value
			},
			getHeader: () => header,
			setHeader: value => {
				header = value
			},
			getSyncTargets: () => renderSync.getTargets(),
			setSyncTargets: value => {
				if (value === null) {
					renderSync.clearCurrentTargets()
					return
				}
				renderSync.setTargets(value)
			},
			getSyncState: () => scrollSyncState,
			getLastAppliedScroll: () => ({ top: lastAppliedScrollTop, left: lastAppliedScrollLeft }),
			setLastAppliedScroll: (top, left) => {
				lastAppliedScrollTop = top
				lastAppliedScrollLeft = left
			},
			getLastHeavyScroll: () => ({ top: lastHeavyScrollTop, left: lastHeavyScrollLeft }),
			setLastHeavyScroll: (top, left) => {
				lastHeavyScrollTop = top
				lastHeavyScrollLeft = left
			},
			isAttached: () => attached,
			setAttached: value => {
				attached = value
			},
			getResizeObserver: () => resizeObserver,
			setResizeObserver: value => {
				resizeObserver = value
			},
			getPendingScrollTop: () => pendingScrollTop,
			setPendingScrollTop: value => {
				pendingScrollTop = value
			},
			getPendingScrollLeft: () => pendingScrollLeft,
			setPendingScrollLeft: value => {
				pendingScrollLeft = value
			},
			getAfterScrollTaskId: () => afterScrollTaskId,
			setAfterScrollTaskId: value => {
				afterScrollTaskId = value
			},
			getScrollSyncTaskId: () => scrollSyncTaskId,
			setScrollSyncTaskId: value => {
				scrollSyncTaskId = value
			},
			getLastScrollSamples: () => ({ top: lastScrollTopSample, left: lastScrollLeftSample }),
			setLastScrollSamples: (top, left) => {
				lastScrollTopSample = top
				lastScrollLeftSample = left
			},
			isPendingHorizontalSettle: () => pendingHorizontalSettle,
			setPendingHorizontalSettle: value => {
				pendingHorizontalSettle = value
			},
			isDriftCorrectionPending: () => driftCorrectionPending,
			setDriftCorrectionPending: value => {
				driftCorrectionPending = value
			},
			resetCachedMeasurements: () => {
				cachedContainerHeight = -1
				cachedContainerWidth = -1
				cachedHeaderHeight = -1
				cachedNativeScrollHeight = -1
				cachedNativeScrollWidth = -1
			},
			clearLayoutMeasurement: () => {
				layoutMeasurement = null
			},
			resetScrollSamples: () => {
				lastScrollTopSample = 0
				lastScrollLeftSample = 0
				lastAppliedScrollTop = 0
				lastAppliedScrollLeft = 0
				driftCorrectionPending = false
				scrollSyncState.scrollTop = 0
				scrollSyncState.scrollLeft = 0
				scrollSyncState.pinnedOffsetLeft = 0
				scrollSyncState.pinnedOffsetRight = 0
			},
		}

		function resolveViewportSyncNextState(overrides?: Partial<ViewportSyncState>): ViewportSyncState {
			return {
				scrollLeft: overrides?.scrollLeft ?? lastScrollLeftSample,
				scrollTop: overrides?.scrollTop ?? lastScrollTopSample,
				pinnedOffsetLeft: overrides?.pinnedOffsetLeft ?? scrollSyncState.pinnedOffsetLeft,
				pinnedOffsetRight: overrides?.pinnedOffsetRight ?? scrollSyncState.pinnedOffsetRight,
			}
		}
		const renderSync = createDataGridViewportRenderSyncService({
			syncState: scrollSyncState,
			resolveNextState: resolveViewportSyncNextState,
		})

		function setViewportSyncTargetsValue(targets: ViewportSyncTargets | null) {
			renderSync.setTargets(targets)
		}

		const heavyIdleMs = Math.max(48, frameBudget.frameDurationMs * 4)
		function resolveGatedHeavyThresholds(): { vertical: number; horizontal: number } {
			const rowHeightCandidate = effectiveRowHeight.value && effectiveRowHeight.value > 0
				? effectiveRowHeight.value
				: baseRowHeight
			const vertical = Math.max(verticalScrollEpsilon, rowHeightCandidate * 0.5)
			const fallbackWidth = columnSnapshot.metrics.widths[0] ?? 32
			const widthReference = lastAverageColumnWidth > 0 ? lastAverageColumnWidth : fallbackWidth
			const horizontalBase = Math.max(horizontalScrollEpsilon, widthReference * 0.5)
			const horizontal = Math.min(Math.max(horizontalScrollEpsilon, horizontalBase), 96)
			return { vertical, horizontal }
		}
		const scrollIo = createDataGridViewportScrollIo({
			hostEnvironment,
			scheduler,
			recordLayoutRead,
			recordLayoutWrite,
			recordSyncScroll,
			queueHeavyUpdate: scheduleUpdate,
			flushSchedulers,
			getOnAfterScroll: () => onAfterScroll,
			state: scrollState,
			normalizeAndClampScroll: Boolean(options.normalizeAndClampScroll),
			clampScrollTop: clampScrollTopValue,
			clampScrollLeft: clampScrollLeftValue,
			frameDurationMs: frameBudget.frameDurationMs,
			resolveHeavyUpdateThresholds: resolveGatedHeavyThresholds,
			getTimestamp: () => clock.now(),
			maxHeavyIdleMs: heavyIdleMs,
			onResizeMetrics: () => captureLayoutMetrics("resize"),
			onScrollMetrics: ({ scrollTop, scrollLeft }) => {
				updateCachedScrollOffsets(scrollTop, scrollLeft)
			},
			onScrollSyncFrame: ({ scrollTop, scrollLeft }) => {
				emitImperativeScrollSync(scrollTop, scrollLeft)
			},
		})

			function attach(containerRef: HTMLDivElement | null, headerRef: HTMLElement | null) {
				scrollIo.attach(containerRef, headerRef)
				if (containerRef) {
					captureLayoutMetrics("attach")
					if (renderSync.getLatestTargets()) {
						renderSync.reapplyLatestTargets()
					}
				}
			}

			function detach() {
				renderSync.clearCurrentTargets()
				lastImperativeScrollSyncSignature = ""
				lastImperativeColumnSignature = ""
				scrollIo.detach()
				cancelScrollRaf()
				layoutCache.reset()
				layoutMeasurement = null
			}

		function getRowCountFromModel(): number {
			return modelBridge.getRowCount()
		}

		function resolveRowFromModel(index: number): VisibleRow | undefined {
			return modelBridge.getRow(index)
		}

		function resolveRowsInRangeFromModel(range: DataGridViewportRange): readonly VisibleRow[] {
			return modelBridge.getRowsInRange(range)
		}

		function setRowModelValue(model: DataGridRowModel<unknown> | null | undefined) {
			modelBridge.setRowModel(model)
		}

		function materializeColumnsFromModel(): DataGridColumn[] {
			return modelBridge.materializeColumns()
		}

		function setColumnModelValue(model: DataGridColumnModel | null | undefined) {
			modelBridge.setColumnModel(model)
		}

		function setZoomValue(nextZoom: number) {
			const normalized = Number.isFinite(nextZoom) && nextZoom > 0 ? nextZoom : 1
			if (normalized === zoom) return
			zoom = normalized
			const timestamp = clock.now()
			virtualization.resetOverscan(timestamp)
			horizontalOverscanController.reset(timestamp)
			scheduleUpdate(true)
		}

		function setVirtualizationEnabledValue(enabled: boolean) {
			const normalized = Boolean(enabled)
			if (virtualizationFlag === normalized) return
			virtualizationFlag = normalized
			scheduleUpdate(true)
		}

		function setRowHeightModeValue(mode: "fixed" | "auto") {
			if (rowHeightMode === mode) return
			rowHeightMode = mode
			scheduleUpdate(true)
		}

		function setBaseRowHeightValue(height: number) {
			const normalized = Number.isFinite(height) && height > 0 ? height : BASE_ROW_HEIGHT
			if (baseRowHeight === normalized) return
			baseRowHeight = normalized
			scheduleUpdate(true)
		}

		function setViewportMetricsValue(metrics: ViewportMetricsSnapshot | null) {
			viewportMetrics = metrics
			if (metrics) {
				const fallbackScrollWidth = cachedNativeScrollWidth >= 0 ? cachedNativeScrollWidth : metrics.containerWidth
				const fallbackScrollHeight = cachedNativeScrollHeight >= 0 ? cachedNativeScrollHeight : metrics.containerHeight
				layoutCache.updateContainer(
					{
						clientWidth: metrics.containerWidth,
						clientHeight: metrics.containerHeight,
						scrollWidth: fallbackScrollWidth,
						scrollHeight: fallbackScrollHeight,
						scrollLeft: lastScrollLeftSample,
						scrollTop: lastScrollTopSample,
					},
					null,
				)
				layoutCache.updateHeader({ height: metrics.headerHeight })
				measureLayout()
			}
			scheduleUpdate(true)
		}

		function setIsLoadingValue(value: boolean) {
			loading = Boolean(value)
		}

		function setImperativeCallbacksValue(callbacks: DataGridViewportImperativeCallbacks | null | undefined) {
			imperativeCallbacks = callbacks ?? {}
			lastImperativeScrollSyncSignature = ""
			lastImperativeColumnSignature = ""
		}

		function setOnAfterScrollValue(callback: (() => void) | null | undefined) {
			onAfterScroll = callback ?? null
		}

		function setOnNearBottomValue(callback: (() => void) | null | undefined) {
			onNearBottom = callback ?? null
		}

		function setDebugModeValue(enabled: boolean) {
			applyDebugMode(Boolean(enabled))
		}

		function handleScroll(event: Event) {
			scrollIo.handleScroll(event)
		}

		function updateViewportHeightValue() {
			scheduleUpdate(true)
		}

		function measureRowHeightValue() {
			scheduleUpdate(true)
		}

		function cancelScrollRaf() {
			frameScheduler.cancel()
			scrollIo.cancelAfterScrollTask()
			cancelPendingHeavyUpdate()
			pendingForce = false
			frameForce = false
			pendingHorizontalSettle = false
			horizontalOverscan = horizontalMinOverscan
			const timestamp = clock.now()
			horizontalOverscanController.reset(timestamp)
			virtualization.resetOverscan(timestamp)
			cachedNativeScrollHeight = -1
			cachedNativeScrollWidth = -1
		}

		function scrollToRowValue(index: number) {
			const total = totalRowCount.value
			if (total <= 0) return
			const clampedIndex = clamp(index, 0, Math.max(total - 1, 0))
			const rawTarget = clampedIndex * effectiveRowHeight.value
			const virtualizationActive = virtualizationEnabled.value || (virtualizationFlag && rowHeightMode === "fixed")
			let target: number
			if (virtualizationActive) {
				// Allow the final row to align with the top edge when virtualization synthesizes scroll height.
				const alignLimit = Math.max(0, (total - 1) * effectiveRowHeight.value)
				target = Math.min(rawTarget, alignLimit)
				if (!Number.isFinite(target)) {
					target = 0
				}
			} else {
				target = clampScrollTopValue(rawTarget)
			}
			pendingScrollTop = target
			scheduleUpdate(true)
			flushSchedulers()
		}

		function scrollToColumnValue(key: string) {
			const map = columnWidthMap.value
			if (!map.size) return
			let offset = 0
			for (const [columnKey, width] of map.entries()) {
				if (columnKey === key) break
				offset += width
			}
			pendingScrollLeft = Math.max(0, offset)
			scheduleUpdate(true)
		}

		function isRowVisibleValue(index: number): boolean {
			return index >= startIndex.value && index <= endIndex.value
		}

		function refreshValue(force?: boolean) {
			scheduleUpdate(force === true)
			if (force === true) {
				flushSchedulers()
			}
		}

		function disposeValue() {
			detach()
			modelBridge.dispose()
			fallbackClientRowModel.dispose()
			fallbackColumnModel.dispose()
			renderSync.dispose()
			flushMeasurementQueue()
			disposeDiagnostics()
			if (ownsScheduler) {
				scheduler.dispose()
			}
			frameScheduler.dispose()
			disposeSignals()
		}

		function scheduleAfterScroll() {
			scrollIo.scheduleAfterScroll()
		}

		function updatePinnedOffsets() {
			renderSync.updatePinnedOffsets({
				left: 0,
				right: 0,
			})
		}

		function applyColumnSnapshot(
			meta: DataGridViewportHorizontalMeta,
			start: number,
			end: number,
			payload: HorizontalVirtualizerPayload,
		) {
			columnSnapshot.columnWidthMap = columnWidthMap.value
			const { visibleStartIndex, visibleEndIndex } = updateColumnSnapshot({
				snapshot: columnSnapshot,
				meta: {
					scrollableColumns: meta.scrollableColumns,
					scrollableIndices: meta.scrollableIndices,
					metrics: meta.metrics,
					pinnedLeft: meta.pinnedLeft,
					pinnedRight: meta.pinnedRight,
					pinnedLeftWidth: meta.pinnedLeftWidth,
					pinnedRightWidth: meta.pinnedRightWidth,
					containerWidthForColumns: meta.containerWidthForColumns,
					indexColumnWidth: meta.indexColumnWidth,
					scrollDirection: meta.scrollDirection,
					version: meta.version,
					zoom: meta.zoom,
				},
				range: { start, end },
				payload,
				getColumnKey,
				resolveColumnWidth,
			})

			const visibleColumnsSnapshot = columnSnapshot.visibleColumns
			visibleColumns.value = visibleColumnsSnapshot.map(entry => entry.column)
			visibleColumnEntries.value = visibleColumnsSnapshot.slice()

			const visibleScrollableSnapshot = columnSnapshot.visibleScrollable
			visibleScrollableColumns.value = visibleScrollableSnapshot.map(entry => entry.column)
			visibleScrollableEntries.value = visibleScrollableSnapshot.slice()

			const pinnedLeftSnapshot = columnSnapshot.pinnedLeft
			pinnedLeftColumns.value = pinnedLeftSnapshot.map(entry => entry.column)
			pinnedLeftEntries.value = pinnedLeftSnapshot.slice()

			const pinnedRightSnapshot = columnSnapshot.pinnedRight
			pinnedRightColumns.value = pinnedRightSnapshot.map(entry => entry.column)
			pinnedRightEntries.value = pinnedRightSnapshot.slice()

			leftPadding.value = payload.leftPadding
			rightPadding.value = payload.rightPadding
			if (columnWidthMap.value !== columnSnapshot.columnWidthMap) {
				columnWidthMap.value = columnSnapshot.columnWidthMap
			}

			visibleStartCol.value = visibleStartIndex
			visibleEndCol.value = visibleEndIndex
			scrollableRange.value = { start, end }

			const columnState = columnVirtualState.value
			columnState.start = start
			columnState.end = end
			columnState.visibleStart = payload.visibleStart
			columnState.visibleEnd = payload.visibleEnd
			columnState.overscanLeading = horizontalVirtualizer.getState().overscanLeading
			columnState.overscanTrailing = horizontalVirtualizer.getState().overscanTrailing
			columnState.poolSize = horizontalVirtualizer.getState().poolSize
			columnState.visibleCount = horizontalVirtualizer.getState().visibleCount
			columnState.totalCount = meta.scrollableColumns.length
			columnState.indexColumnWidth = meta.indexColumnWidth
			columnState.pinnedRightWidth = meta.pinnedRightWidth
			columnVirtualState.value = { ...columnState }

			updatePinnedOffsets()
		}

		function clampScrollTopValue(value: number) {
			return virtualization.clampScrollTop(value)
		}

		function getViewportSyncStateValue(): ViewportSyncState {
			return {
				scrollTop: scrollSyncState.scrollTop,
				scrollLeft: scrollSyncState.scrollLeft,
				pinnedOffsetLeft: scrollSyncState.pinnedOffsetLeft,
				pinnedOffsetRight: scrollSyncState.pinnedOffsetRight,
			}
		}

		function getIntegrationSnapshotValue(): ViewportIntegrationSnapshot {
			const rowRange = derived.rows.visibleRange.value
			const columnRange = scrollableRange.value
			const pinnedLeftWidth = computePinnedWidth(pinnedLeftEntries.value)
			const pinnedRightWidth = computePinnedWidth(pinnedRightEntries.value)
			return {
				scrollTop: scrollTop.value,
				scrollLeft: scrollLeft.value,
				viewportHeight: viewportHeight.value,
				viewportWidth: viewportWidth.value,
				visibleRowRange: {
					start: rowRange.start,
					end: rowRange.end,
					total: totalRowCount.value,
				},
				visibleColumnRange: {
					start: columnRange.start,
					end: columnRange.end,
					total: columnVirtualState.value.totalCount,
				},
				pinnedWidth: {
					left: pinnedLeftWidth,
					right: pinnedRightWidth,
				},
				overlaySync: getViewportSyncStateValue(),
			}
		}

		function clampScrollLeftValue(value: number) {
			if (!Number.isFinite(value)) return 0
			const containerRef = container
			const nativeLimit = containerRef
				? Math.max(0, containerRef.scrollWidth - containerRef.clientWidth)
				: cachedNativeScrollWidth >= 0 && cachedContainerWidth >= 0
					? Math.max(0, cachedNativeScrollWidth - cachedContainerWidth)
					: null
			const clampResult = clampHorizontalOffset(value, {
				...horizontalClampContext,
				nativeScrollLimit: nativeLimit,
				virtualizationEnabled: virtualizationEnabled.value,
			})
			const normalized = clampResult.normalized

			if (isDebugEnabled()) {
				console.debug("[DataGrid] clampScrollLeftValue", {
					requested: value,
					normalized,
					nativeLimit: clampResult.nativeLimit,
					effectiveViewport: clampResult.effectiveViewport,
					trailingGap: clampResult.trailingGap,
					bufferPx: clampResult.bufferPx,
					maxScroll: clampResult.maxScroll,
				})
			}

			return normalized
		}

		function logHorizontalDebug(payload: {
			scrollLeft: number
			deltaLeft: number
			overscanColumns: number
			horizontalOverscan: number
			velocity: number
			direction: number
			horizontalState: AxisVirtualizerState<HorizontalVirtualizerPayload>
			columnMeta: DataGridViewportHorizontalMeta
			virtualizationEnabled: boolean
		}) {
			if (!isDebugEnabled()) return
			const containerRef = container
			const domStats = resolveDomStats(hostEnvironment, containerRef)
			console.debug("[DataGrid][Horizontal]", {
				scrollLeft: Number(payload.scrollLeft.toFixed(2)),
				deltaLeft: Number(payload.deltaLeft.toFixed(2)),
				direction: payload.direction,
				overscanColumns: payload.overscanColumns,
				horizontalOverscan: payload.horizontalOverscan,
				velocity: Number(payload.velocity.toFixed(3)),
				virtualizationEnabled: payload.virtualizationEnabled,
				state: {
					start: payload.horizontalState.startIndex,
					end: payload.horizontalState.endIndex,
					poolSize: payload.horizontalState.poolSize,
					visible: payload.horizontalState.visibleCount,
					overscanLeading: payload.horizontalState.overscanLeading,
					overscanTrailing: payload.horizontalState.overscanTrailing,
				},
				columns: {
					total: payload.columnMeta.scrollableColumns.length,
					pinnedLeft: payload.columnMeta.pinnedLeft.length,
					pinnedRight: payload.columnMeta.pinnedRight.length,
					containerWidth: Number(payload.columnMeta.containerWidthForColumns.toFixed(1)),
					totalWidth: Number(payload.columnMeta.metrics.totalWidth.toFixed(1)),
				},
				dom: {
					rowLayers: domStats.rowLayers,
					cells: domStats.cells,
					fillers: domStats.fillers,
				},
			})
		}

			function runUpdate(force: boolean) {
				if (!heavyFramePending && !heavyFrameInProgress && !force && !pendingForce) {
					return
				}
				if (heavyFrameInProgress) {
					pendingForce = pendingForce || force
					heavyFramePending = true
					frameScheduler.invalidate()
					return
				}
				heavyFrameInProgress = true
				heavyFramePending = false
				try {
					const containerRef = container
					if (!containerRef) {
						return
					}

					const rowCount = getRowCountFromModel()
					totalRowCount.value = rowCount

					const virtualizationByProp = virtualizationFlag
					const verticalVirtualizationEnabled = virtualizationByProp && rowHeightMode === "fixed"
					virtualizationEnabled.value = verticalVirtualizationEnabled

					const zoomFactor = Math.max(zoom || 1, 0.01)
					const layoutScale = (options.supportsCssZoom ?? supportsCssZoom) ? zoomFactor : 1
					const resolvedRowHeight = baseRowHeight * layoutScale
					effectiveRowHeight.value = resolvedRowHeight

					const measurements = layoutMeasurement
					const resolvedDimensions = resolveViewportDimensions({
						viewportMetrics,
						layoutMeasurement: measurements,
						cachedContainerHeight,
						cachedContainerWidth,
						cachedHeaderHeight,
						resolvedRowHeight,
						fallbackColumnWidth: columnSnapshot.containerWidthForColumns,
					})
					const containerHeight = resolvedDimensions.containerHeight
					const viewportHeightValue = resolvedDimensions.viewportHeight
					const viewportWidthValue = resolvedDimensions.viewportWidth
					viewportHeight.value = viewportHeightValue
					viewportWidth.value = viewportWidthValue

					const pendingScrollTopRequest = pendingScrollTop
					const pendingScrollLeftRequest = pendingScrollLeft
					const pendingScrollResolution = resolvePendingScroll({
						pendingScrollTopRequest,
						pendingScrollLeftRequest,
						measuredScrollTop: measurements?.scrollTop,
						measuredScrollLeft: measurements?.scrollLeft,
						lastScrollTopSample,
						lastScrollLeftSample,
					})
					const pendingTop = pendingScrollResolution.pendingTop
					const pendingLeft = pendingScrollResolution.pendingLeft
					const measuredScrollTopFromPending = pendingScrollResolution.measuredScrollTopFromPending
					const measuredScrollLeftFromPending = pendingScrollResolution.measuredScrollLeftFromPending
					const normalizedFallbackScrollLeft = pendingScrollResolution.fallbackScrollLeft
					pendingScrollTop = null
					pendingScrollLeft = null

					const scrollTopDelta = Math.abs(pendingTop - lastScrollTopSample)
					const scrollLeftDelta = Math.abs(pendingLeft - lastScrollLeftSample)
					const shouldFastPath = shouldUseFastPath({
						force,
						pendingHorizontalSettle,
						measuredScrollTopFromPending,
						measuredScrollLeftFromPending,
						hadPendingScrollTop: pendingScrollResolution.hadPendingScrollTop,
						hadPendingScrollLeft: pendingScrollResolution.hadPendingScrollLeft,
						scrollTopDelta,
						scrollLeftDelta,
						verticalScrollEpsilon,
						horizontalScrollEpsilon,
					})

					if (shouldFastPath) {
						scrollTop.value = lastScrollTopSample
						scrollLeft.value = lastScrollLeftSample
						pendingHorizontalSettle = false
						scheduleAfterScroll()
						return
					}

					recordHeavyPass()

					const virtualizationPrepared = virtualization.prepare({
						resolveRow: resolveRowFromModel,
						resolveRowsInRange: resolveRowsInRangeFromModel,
						totalRowCount: rowCount,
						viewportHeight: viewportHeightValue,
						resolvedRowHeight,
						zoomFactor,
						virtualizationEnabled: verticalVirtualizationEnabled,
						pendingScrollTop: pendingTop,
						lastScrollTopSample,
						pendingScrollTopRequest,
						measuredScrollTopFromPending,
						cachedNativeScrollHeight,
						containerHeight,
						imperativeCallbacks,
					})

					if (!virtualizationPrepared) {
						recordVirtualizerSkip()
						scheduleAfterScroll()
						return
					}
					recordVirtualizerUpdate()
					// Two-phase (A6): virtualization apply happens later with pending writes.

					let nextScrollTop = virtualizationPrepared.scrollTop
					let syncScrollTopValue: number | null = virtualizationPrepared.syncedScrollTop
					let syncScrollLeftValue: number | null = null
					const nowTs = virtualizationPrepared.timestamp
					const columns = materializeColumnsFromModel()

			const horizontalMetaResult = buildHorizontalMeta({
				columns,
				layoutScale,
				resolvePinMode,
				viewportWidth: viewportWidthValue,
				cachedNativeScrollWidth,
				cachedContainerWidth,
				lastScrollDirection,
				smoothedHorizontalVelocity,
				lastSignature: lastHorizontalMetaSignature,
				version: horizontalMetaVersion,
				scrollWidth: measurements?.scrollWidth ?? cachedNativeScrollWidth,
			})
			horizontalMetaVersion = horizontalMetaResult.version
			lastHorizontalMetaSignature = horizontalMetaResult.signature
			const columnMeta = horizontalMetaResult.meta
			const horizontalSizing = resolveHorizontalSizing({
				columnMeta,
				viewportWidth: viewportWidthValue,
				totalRowCount: totalRowCount.value,
				resolvedRowHeight,
				viewportHeight: viewportHeightValue,
			})
			const contentWidthEstimate = horizontalSizing.contentWidthEstimate
			const contentHeightEstimate = horizontalSizing.contentHeightEstimate
			layoutCache.updateContentDimensions(contentWidthEstimate, contentHeightEstimate)
			const averageColumnWidth = horizontalSizing.averageColumnWidth
			lastAverageColumnWidth = averageColumnWidth
			horizontalClampContext = horizontalSizing.horizontalClampContext

			const currentPendingLeft = Math.max(0, pendingLeft)
			const rawDeltaLeft = currentPendingLeft - lastScrollLeftSample
			const deltaLeft = Math.abs(rawDeltaLeft)
			const horizontalDirection = rawDeltaLeft === 0 ? lastScrollDirection : rawDeltaLeft > 0 ? 1 : -1
			const horizontalVirtualizationEnabled = true

			const metaVersionChanged = columnMeta.version !== lastAppliedHorizontalMetaVersion
			const horizontalUpdateForced =
				pendingScrollLeftRequest != null || measuredScrollLeftFromPending || metaVersionChanged

			pendingHorizontalSettle = false

			const imperativeOnColumns =
				typeof imperativeCallbacks.onColumns === "function"
					? imperativeCallbacks.onColumns
					: null

			const horizontalCallbacks = {
				applyColumnSnapshot,
				logHorizontalDebug,
				onColumns: imperativeOnColumns
					? payload => {
						const snapshot = payload.snapshot
						const signature = [
							Math.round(payload.scrollLeft * 1000),
							Math.round(payload.viewportWidth * 1000),
							Math.round(payload.zoom * 1000),
							snapshot.scrollableStart,
							snapshot.scrollableEnd,
							snapshot.visibleStart,
							snapshot.visibleEnd,
							Math.round(snapshot.leftPadding * 1000),
							Math.round(snapshot.rightPadding * 1000),
							Math.round(snapshot.totalScrollableWidth * 1000),
							Math.round(snapshot.visibleScrollableWidth * 1000),
							Math.round(snapshot.pinnedLeftWidth * 1000),
							Math.round(snapshot.pinnedRightWidth * 1000),
						].join("|")
						if (signature === lastImperativeColumnSignature) {
							return
						}
						lastImperativeColumnSignature = signature
						imperativeOnColumns(payload)
					}
					: undefined,
			} satisfies HorizontalUpdateCallbacks

			// Two-phase (A6): compute horizontal plan without DOM writes.
			const horizontalPrepared: HorizontalUpdatePrepared = prepareHorizontalViewport({
				columnMeta,
				horizontalVirtualizer,
				horizontalOverscanController,
				callbacks: horizontalCallbacks,
				columnSnapshot,
				layoutScale,
				viewportWidth: viewportWidthValue,
				nowTs,
				frameTimeValue: frameTime.value,
				averageColumnWidth,
				scrollDirection: horizontalDirection,
				horizontalVirtualizationEnabled,
				horizontalUpdateForced,
				currentPendingLeft,
				previousScrollLeftSample: lastScrollLeftSample,
				deltaLeft,
				horizontalScrollEpsilon,
				pendingScrollLeftRequest,
				measuredScrollLeftFromPending,
				currentScrollLeftMeasurement: normalizedFallbackScrollLeft,
				smoothedHorizontalVelocity,
				lastHorizontalSampleTime,
				horizontalOverscan,
				lastAppliedHorizontalMetaVersion,
			})

			const horizontalScrollLeftValue = horizontalPrepared.scrollLeftValue
			if (horizontalPrepared.syncScrollLeftValue != null) {
				syncScrollLeftValue = horizontalPrepared.syncScrollLeftValue
			}

			smoothedHorizontalVelocity = horizontalPrepared.smoothedHorizontalVelocity
			horizontalOverscan = horizontalPrepared.horizontalOverscan
			lastHorizontalSampleTime = horizontalPrepared.lastHorizontalSampleTime
			lastScrollDirection = horizontalPrepared.lastScrollDirection
			lastScrollLeftSample = horizontalPrepared.lastScrollLeftSample
			lastAppliedHorizontalMetaVersion = horizontalPrepared.lastAppliedHorizontalMetaVersion

			const virtualizationResult = virtualization.applyPrepared(virtualizationPrepared, {
				resolveRow: resolveRowFromModel,
				resolveRowsInRange: resolveRowsInRangeFromModel,
				imperativeCallbacks,
			})
			const activeRowModel = modelBridge.getActiveRowModel()
			const modelSnapshot = activeRowModel.getSnapshot()
			const modelRange = modelSnapshot.viewportRange
			if (
				modelRange.start !== virtualizationResult.visibleRange.start ||
				modelRange.end !== virtualizationResult.visibleRange.end
			) {
				activeRowModel.setViewportRange(virtualizationResult.visibleRange)
			}
			const pendingVerticalScrollWrite = virtualizationResult.pendingScrollWrite
			const pendingHorizontalScrollWrite = horizontalPrepared.pendingScrollWrite

			applyHorizontalViewport({
				callbacks: horizontalCallbacks,
				prepared: horizontalPrepared,
			})
			scrollIo.applyProgrammaticScrollWrites({
				scrollTop: pendingVerticalScrollWrite,
				scrollLeft: pendingHorizontalScrollWrite,
			})
			// Verified (A5): heavy path leaves pinned/header transforms to sync layer.
			scrollLeft.value = horizontalScrollLeftValue
			nextScrollTop = virtualizationResult.scrollTop
			syncScrollTopValue = virtualizationResult.syncedScrollTop
			lastScrollTopSample = virtualizationResult.lastScrollTopSample
			pendingScrollTop = virtualizationResult.pendingScrollTop

			const resolvedScrollTop = syncScrollTopValue ?? nextScrollTop
			const resolvedScrollLeft = syncScrollLeftValue ?? horizontalScrollLeftValue
			updateCachedScrollOffsets(resolvedScrollTop, resolvedScrollLeft)
			lastHeavyScrollTop = resolvedScrollTop
			lastHeavyScrollLeft = resolvedScrollLeft

			emitImperativeScrollSync(resolvedScrollTop, resolvedScrollLeft, nowTs)

				if (
					onNearBottom &&
					shouldNotifyNearBottom({
						nextScrollTop,
						totalContentHeight: totalContentHeight.value,
						viewportHeight: viewportHeightValue,
						totalRowCount: totalRowCount.value,
						loading,
					})
				) {
					onNearBottom()
				}

				lastScrollTopSample = nextScrollTop

				scheduleAfterScroll()
			} finally {
				heavyFrameInProgress = false
			}
		}

		return {
			input,
			core,
			derived,
			attach,
			detach,
			setRowModel: setRowModelValue,
			setColumnModel: setColumnModelValue,
			setZoom: setZoomValue,
			setVirtualizationEnabled: setVirtualizationEnabledValue,
			setRowHeightMode: setRowHeightModeValue,
			setBaseRowHeight: setBaseRowHeightValue,
			setViewportMetrics: setViewportMetricsValue,
			setIsLoading: setIsLoadingValue,
			setImperativeCallbacks: setImperativeCallbacksValue,
			setOnAfterScroll: setOnAfterScrollValue,
			setOnNearBottom: setOnNearBottomValue,
			setDebugMode: setDebugModeValue,
			handleScroll,
			updateViewportHeight: updateViewportHeightValue,
			measureRowHeight: measureRowHeightValue,
			cancelScrollRaf,
			scrollToRow: scrollToRowValue,
			scrollToColumn: scrollToColumnValue,
			isRowVisible: isRowVisibleValue,
			clampScrollTopValue,
			setViewportSyncTargets: setViewportSyncTargetsValue,
			getViewportSyncState: getViewportSyncStateValue,
			getIntegrationSnapshot: getIntegrationSnapshotValue,
			refresh: refreshValue,
			dispose: disposeValue,
		}
	}
