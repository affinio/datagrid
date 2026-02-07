import { createWritableSignal, } from "../runtime/signals";
import { createFrameScheduler } from "../runtime/frameScheduler";
import { createRafScheduler } from "../runtime/rafScheduler";
import { flushMeasurements } from "../runtime/measurementQueue";
import { BASE_ROW_HEIGHT, clamp } from "../utils/constants";
import { resolveColumnWidth as resolveColumnWidthDefault, supportsCssZoom, } from "../dom/gridUtils";
import { createHorizontalOverscanController } from "../virtualization/dynamicOverscan";
import { updateColumnSnapshot, createEmptyColumnSnapshot, } from "../virtualization/columnSnapshot";
import { createAxisVirtualizer, } from "../virtualization/axisVirtualizer";
import { createHorizontalAxisStrategy, } from "../virtualization/horizontalVirtualizer";
import { createTableViewportSignals, } from "./tableViewportSignals";
import { createTableViewportDiagnostics } from "./tableViewportDiagnostics";
import { createTableViewportScrollIo, } from "./tableViewportScrollIo";
import { createTableViewportVirtualization } from "./tableViewportVirtualization";
import { buildHorizontalMeta, } from "./tableViewportHorizontalMeta";
import { applyHorizontalViewport, prepareHorizontalViewport, } from "./tableViewportHorizontalUpdate";
import { applyViewportSyncTransforms, resetViewportSyncTransforms } from "./scrollSync";
import { resolveCanonicalPinMode } from "../columns/pinning";
import { clampHorizontalOffset, } from "./tableViewportHorizontalClamp";
import { createDefaultHostEnvironment, createMonotonicClock, } from "./tableViewportConfig";
import { createLayoutMeasurementCache, } from "./tableViewportLayoutCache";
import { FRAME_BUDGET_CONSTANTS, HORIZONTAL_VIRTUALIZATION_CONSTANTS, VERTICAL_VIRTUALIZATION_CONSTANTS, } from "./tableViewportConstants";
import { sampleBoundingRect, sampleContainerMetrics, sampleHeaderHeight, resolveDomStats, } from "./tableViewportEnvironment";
export function createTableViewportController(options) {
    const resolveColumnWidth = options.resolveColumnWidth ?? resolveColumnWidthDefault;
    const getColumnKey = options.getColumnKey ?? ((column) => column.key);
    const fallbackResolvePinMode = (column) => resolveCanonicalPinMode(column);
    const resolvePinMode = (column) => {
        const userResolved = options.resolvePinMode ? options.resolvePinMode(column) : fallbackResolvePinMode(column);
        if (userResolved === "left" || userResolved === "right" || userResolved === "none") {
            return userResolved;
        }
        return fallbackResolvePinMode(column);
    };
    const hostEnvironment = options.hostEnvironment ?? createDefaultHostEnvironment();
    const clock = options.clock ?? createMonotonicClock();
    const frameBudget = options.frameBudget ?? FRAME_BUDGET_CONSTANTS;
    const verticalVirtualization = options.verticalVirtualization ?? VERTICAL_VIRTUALIZATION_CONSTANTS;
    const horizontalVirtualization = options.horizontalVirtualization ?? HORIZONTAL_VIRTUALIZATION_CONSTANTS;
    const verticalScrollEpsilon = verticalVirtualization.scrollEpsilon;
    const horizontalScrollEpsilon = horizontalVirtualization.scrollEpsilon;
    const horizontalMinOverscan = Math.max(0, horizontalVirtualization.minOverscan);
    const runtimeOverrides = options.runtime ?? {};
    const scheduler = runtimeOverrides.rafScheduler ??
        (typeof runtimeOverrides.createRafScheduler === "function"
            ? runtimeOverrides.createRafScheduler()
            : createRafScheduler());
    const ownsScheduler = !runtimeOverrides.rafScheduler;
    const createFrameSchedulerFn = runtimeOverrides.createFrameScheduler ?? createFrameScheduler;
    const flushMeasurementQueue = runtimeOverrides.measurementQueue?.flush ?? flushMeasurements;
    const createSignal = (initial) => {
        const factory = options.createSignal;
        if (factory) {
            return factory(initial);
        }
        return createWritableSignal(initial);
    };
    const signals = createTableViewportSignals(createSignal);
    const { input, core, derived, dispose: disposeSignals } = signals;
    const { scrollTop, scrollLeft, viewportHeight, viewportWidth, virtualizationEnabled, } = input;
    const { totalRowCount, effectiveRowHeight, totalContentHeight, startIndex, endIndex, } = core;
    const { columns: { visibleColumns, visibleColumnEntries, visibleScrollableColumns, visibleScrollableEntries, pinnedLeftColumns, pinnedLeftEntries, pinnedRightColumns, pinnedRightEntries, leftPadding, rightPadding, columnWidthMap, visibleStartCol, visibleEndCol, scrollableRange, columnVirtualState, }, metrics: { debugMode, fps, frameTime, droppedFrames, layoutReads, layoutWrites, syncScrollRate, heavyUpdateRate, virtualizerUpdates, virtualizerSkips, }, } = derived;
    const frameScheduler = createFrameSchedulerFn({
        onBeforeFrame: () => {
            if (!heavyFramePending && !heavyFrameInProgress) {
                return;
            }
            frameForce = pendingForce;
            pendingForce = false;
        },
        onRead: () => {
            if (!heavyFramePending && !heavyFrameInProgress) {
                return;
            }
            measureLayout();
        },
        onCommit: () => {
            if (!heavyFramePending && !heavyFrameInProgress) {
                frameForce = false;
                return;
            }
            runUpdate(frameForce);
            frameForce = false;
        },
    });
    const diagnostics = createTableViewportDiagnostics({
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
    });
    const { recordLayoutRead, recordLayoutWrite, recordSyncScroll, recordHeavyPass, recordVirtualizerUpdate, recordVirtualizerSkip, setDebugMode: applyDebugMode, isDebugEnabled, dispose: disposeDiagnostics, } = diagnostics;
    const virtualization = createTableViewportVirtualization({
        signals,
        diagnostics,
        clock,
        frameBudget,
        verticalConfig: verticalVirtualization,
    });
    const horizontalVirtualizer = createAxisVirtualizer("horizontal", createHorizontalAxisStrategy(), {
        visibleStart: 0,
        visibleEnd: 0,
        leftPadding: 0,
        rightPadding: 0,
        totalScrollableWidth: 0,
        visibleScrollableWidth: 0,
        averageWidth: 0,
        scrollSpeed: 0,
        effectiveViewport: 0,
    });
    const horizontalOverscanController = createHorizontalOverscanController({
        minOverscan: horizontalMinOverscan,
        velocityRatio: horizontalVirtualization.velocityOverscanRatio,
        viewportRatio: horizontalVirtualization.viewportOverscanRatio,
        decay: horizontalVirtualization.overscanDecay,
        maxViewportMultiplier: horizontalVirtualization.maxViewportMultiplier,
        teleportMultiplier: frameBudget.teleportMultiplier,
        frameDurationMs: frameBudget.frameDurationMs,
        minSampleMs: frameBudget.minVelocitySampleMs,
    });
    const columnSnapshot = createEmptyColumnSnapshot();
    // Cache layout metrics from observers so the heavy path never touches the DOM.
    const layoutCache = createLayoutMeasurementCache();
    let container = null;
    let header = null;
    let processedRows = [];
    let columns = [];
    let zoom = 1;
    let virtualizationFlag = true;
    let rowHeightMode = "fixed";
    let baseRowHeight = BASE_ROW_HEIGHT;
    let viewportMetrics = null;
    let loading = false;
    let serverIntegration = options.serverIntegration ?? {
        rowModel: null,
        enabled: false,
    };
    let imperativeCallbacks = options.imperativeCallbacks ?? {};
    let onAfterScroll = options.onAfterScroll ?? null;
    let onNearBottom = options.onNearBottom ?? null;
    let pendingScrollTop = null;
    let pendingScrollLeft = null;
    let afterScrollTaskId = null;
    let pendingForce = false;
    let frameForce = false;
    let heavyFramePending = false;
    let heavyFrameInProgress = false;
    let heavyUpdateTaskId = null;
    let pendingHorizontalSettle = false;
    let horizontalOverscan = horizontalMinOverscan;
    let resizeObserver = null;
    let attached = false;
    let lastScrollTopSample = 0;
    let lastScrollLeftSample = 0;
    let lastAppliedScrollTop = 0;
    let driftCorrectionPending = false;
    let lastHorizontalSampleTime = 0;
    let smoothedHorizontalVelocity = 0;
    let horizontalMetaVersion = 0;
    let lastHorizontalMetaSignature = "";
    let lastAppliedHorizontalMetaVersion = -1;
    let cachedContainerWidth = -1;
    let cachedContainerHeight = -1;
    let cachedHeaderHeight = -1;
    let cachedNativeScrollHeight = -1;
    let cachedNativeScrollWidth = -1;
    let layoutMeasurement = null;
    let lastAppliedScrollLeft = 0;
    let lastHeavyScrollTop = 0;
    let lastHeavyScrollLeft = 0;
    let lastAverageColumnWidth = 0;
    let lastScrollDirection = 0;
    let horizontalClampContext = {
        totalScrollableWidth: 0,
        containerWidthForColumns: 0,
        pinnedLeftWidth: 0,
        pinnedRightWidth: 0,
        averageColumnWidth: 1,
        nativeScrollLimit: 0,
        virtualizationEnabled: true,
    };
    let scrollSyncTargets = null;
    let latestViewportSyncTargets = null;
    const scrollSyncState = {
        scrollLeft: 0,
        scrollTop: 0,
        pinnedOffsetLeft: 0,
        pinnedOffsetRight: 0,
    };
    function measureLayout() {
        if (!attached) {
            layoutMeasurement = null;
            return;
        }
        layoutMeasurement = layoutCache.snapshot();
    }
    function captureLayoutMetrics(label) {
        // All DOM reads stay confined to observer-driven phases.
        if (!container) {
            return;
        }
        flushMeasurementQueue();
        const containerMetrics = sampleContainerMetrics(hostEnvironment, recordLayoutRead, container);
        const rect = sampleBoundingRect(hostEnvironment, recordLayoutRead, container);
        layoutCache.updateContainer(containerMetrics, rect);
        cachedContainerHeight = containerMetrics.clientHeight > 0 ? containerMetrics.clientHeight : cachedContainerHeight;
        cachedContainerWidth = containerMetrics.clientWidth > 0 ? containerMetrics.clientWidth : cachedContainerWidth;
        cachedNativeScrollHeight = containerMetrics.scrollHeight;
        cachedNativeScrollWidth = containerMetrics.scrollWidth;
        if (header) {
            const headerHeightValue = sampleHeaderHeight(hostEnvironment, recordLayoutRead, header);
            layoutCache.updateHeader({ height: headerHeightValue });
            if (headerHeightValue > 0) {
                cachedHeaderHeight = headerHeightValue;
            }
        }
        else {
            layoutCache.updateHeader({ height: 0 });
            cachedHeaderHeight = 0;
        }
        if (label !== "manual") {
            measureLayout();
        }
    }
    function cancelPendingHeavyUpdate() {
        if (heavyUpdateTaskId === null) {
            return;
        }
        scheduler.cancel(heavyUpdateTaskId);
        heavyUpdateTaskId = null;
    }
    function requestHeavyFrame(force) {
        if (heavyFrameInProgress) {
            heavyFramePending = true;
            frameScheduler.invalidate();
            return;
        }
        if (!heavyFramePending) {
            heavyFramePending = true;
            frameScheduler.invalidate();
            return;
        }
        if (force) {
            frameScheduler.invalidate();
        }
    }
    function scheduleUpdate(force = false) {
        pendingForce = pendingForce || force;
        if (force) {
            cancelPendingHeavyUpdate();
            requestHeavyFrame(true);
            return;
        }
        if (heavyFrameInProgress) {
            requestHeavyFrame(false);
            return;
        }
        if (heavyFramePending) {
            return;
        }
        if (heavyUpdateTaskId !== null) {
            return;
        }
        const taskId = scheduler.schedule(() => {
            heavyUpdateTaskId = null;
            requestHeavyFrame(false);
        }, { priority: "normal" });
        if (taskId >= 0) {
            heavyUpdateTaskId = taskId;
            return;
        }
        requestHeavyFrame(false);
    }
    function flushSchedulers() {
        flushMeasurementQueue();
        frameScheduler.flush();
        scheduler.flush();
    }
    function updateCachedScrollOffsets(scrollTopValue, scrollLeftValue) {
        const metrics = {
            clientWidth: cachedContainerWidth >= 0 ? cachedContainerWidth : 0,
            clientHeight: cachedContainerHeight >= 0 ? cachedContainerHeight : 0,
            scrollWidth: cachedNativeScrollWidth >= 0 ? cachedNativeScrollWidth : 0,
            scrollHeight: cachedNativeScrollHeight >= 0 ? cachedNativeScrollHeight : 0,
            scrollTop: scrollTopValue,
            scrollLeft: scrollLeftValue,
        };
        layoutCache.updateContainer(metrics, null);
        lastScrollTopSample = scrollTopValue;
        lastScrollLeftSample = scrollLeftValue;
    }
    function emitImperativeScrollSync(scrollTopValue, scrollLeftValue, timestamp) {
        if (typeof imperativeCallbacks.onScrollSync !== "function") {
            return;
        }
        const resolvedTs = Number.isFinite(timestamp) ? timestamp : clock.now();
        imperativeCallbacks.onScrollSync({
            scrollTop: scrollTopValue,
            scrollLeft: scrollLeftValue,
            timestamp: resolvedTs,
        });
    }
    let scrollSyncTaskId = null;
    const scrollState = {
        getContainer: () => container,
        setContainer: value => {
            container = value;
        },
        getHeader: () => header,
        setHeader: value => {
            header = value;
        },
        getSyncTargets: () => scrollSyncTargets,
        setSyncTargets: value => {
            scrollSyncTargets = value;
        },
        getSyncState: () => scrollSyncState,
        getLastAppliedScroll: () => ({ top: lastAppliedScrollTop, left: lastAppliedScrollLeft }),
        setLastAppliedScroll: (top, left) => {
            lastAppliedScrollTop = top;
            lastAppliedScrollLeft = left;
        },
        getLastHeavyScroll: () => ({ top: lastHeavyScrollTop, left: lastHeavyScrollLeft }),
        setLastHeavyScroll: (top, left) => {
            lastHeavyScrollTop = top;
            lastHeavyScrollLeft = left;
        },
        isAttached: () => attached,
        setAttached: value => {
            attached = value;
        },
        getResizeObserver: () => resizeObserver,
        setResizeObserver: value => {
            resizeObserver = value;
        },
        getPendingScrollTop: () => pendingScrollTop,
        setPendingScrollTop: value => {
            pendingScrollTop = value;
        },
        getPendingScrollLeft: () => pendingScrollLeft,
        setPendingScrollLeft: value => {
            pendingScrollLeft = value;
        },
        getAfterScrollTaskId: () => afterScrollTaskId,
        setAfterScrollTaskId: value => {
            afterScrollTaskId = value;
        },
        getScrollSyncTaskId: () => scrollSyncTaskId,
        setScrollSyncTaskId: value => {
            scrollSyncTaskId = value;
        },
        getLastScrollSamples: () => ({ top: lastScrollTopSample, left: lastScrollLeftSample }),
        setLastScrollSamples: (top, left) => {
            lastScrollTopSample = top;
            lastScrollLeftSample = left;
        },
        isPendingHorizontalSettle: () => pendingHorizontalSettle,
        setPendingHorizontalSettle: value => {
            pendingHorizontalSettle = value;
        },
        isDriftCorrectionPending: () => driftCorrectionPending,
        setDriftCorrectionPending: value => {
            driftCorrectionPending = value;
        },
        resetCachedMeasurements: () => {
            cachedContainerHeight = -1;
            cachedContainerWidth = -1;
            cachedHeaderHeight = -1;
            cachedNativeScrollHeight = -1;
            cachedNativeScrollWidth = -1;
        },
        clearLayoutMeasurement: () => {
            layoutMeasurement = null;
        },
        resetScrollSamples: () => {
            lastScrollTopSample = 0;
            lastScrollLeftSample = 0;
            lastAppliedScrollTop = 0;
            lastAppliedScrollLeft = 0;
            driftCorrectionPending = false;
            scrollSyncState.scrollTop = 0;
            scrollSyncState.scrollLeft = 0;
            scrollSyncState.pinnedOffsetLeft = 0;
            scrollSyncState.pinnedOffsetRight = 0;
        },
    };
    function resolveViewportSyncNextState(overrides) {
        return {
            scrollLeft: overrides?.scrollLeft ?? lastScrollLeftSample,
            scrollTop: overrides?.scrollTop ?? lastScrollTopSample,
            pinnedOffsetLeft: overrides?.pinnedOffsetLeft ?? scrollSyncState.pinnedOffsetLeft,
            pinnedOffsetRight: overrides?.pinnedOffsetRight ?? scrollSyncState.pinnedOffsetRight,
        };
    }
    function setViewportSyncTargetsValue(targets) {
        latestViewportSyncTargets = targets;
        if (scrollSyncTargets === targets) {
            if (targets) {
                applyViewportSyncTransforms(targets, scrollSyncState, resolveViewportSyncNextState());
            }
            scrollState.setSyncTargets(targets);
            return;
        }
        scrollSyncTargets = targets;
        scrollState.setSyncTargets(targets);
        if (!targets) {
            resetViewportSyncTransforms(null, scrollSyncState);
            return;
        }
        alignOverlayRootWithScrollHost(targets);
        applyViewportSyncTransforms(targets, scrollSyncState, resolveViewportSyncNextState());
    }
    function alignOverlayRootWithScrollHost(targets) {
        const host = targets?.scrollHost;
        const overlayRoot = targets?.overlayRoot;
        if (!host || !overlayRoot) {
            return;
        }
        if (overlayRoot.parentElement !== host && typeof host.appendChild === "function") {
            // Deterministic sync-target contract: no DOM queries, only explicit refs from host adapter.
            host.appendChild(overlayRoot);
        }
    }
    const heavyIdleMs = Math.max(48, frameBudget.frameDurationMs * 4);
    function resolveGatedHeavyThresholds() {
        const rowHeightCandidate = effectiveRowHeight.value && effectiveRowHeight.value > 0
            ? effectiveRowHeight.value
            : baseRowHeight;
        const vertical = Math.max(verticalScrollEpsilon, rowHeightCandidate * 0.5);
        const fallbackWidth = columnSnapshot.metrics.widths[0] ?? 32;
        const widthReference = lastAverageColumnWidth > 0 ? lastAverageColumnWidth : fallbackWidth;
        const horizontalBase = Math.max(horizontalScrollEpsilon, widthReference * 0.5);
        const horizontal = Math.min(Math.max(horizontalScrollEpsilon, horizontalBase), 96);
        return { vertical, horizontal };
    }
    const scrollIo = createTableViewportScrollIo({
        hostEnvironment,
        scheduler,
        recordLayoutRead,
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
            updateCachedScrollOffsets(scrollTop, scrollLeft);
        },
        onScrollSyncFrame: ({ scrollTop, scrollLeft }) => {
            emitImperativeScrollSync(scrollTop, scrollLeft);
        },
    });
    function attach(containerRef, headerRef) {
        scrollIo.attach(containerRef, headerRef);
        if (containerRef) {
            captureLayoutMetrics("attach");
            if (latestViewportSyncTargets) {
                setViewportSyncTargetsValue(latestViewportSyncTargets);
            }
        }
    }
    function detach() {
        resetViewportSyncTransforms(scrollSyncTargets, scrollSyncState);
        scrollIo.detach();
        cancelScrollRaf();
        layoutCache.reset();
        layoutMeasurement = null;
    }
    function setProcessedRowsValue(rows) {
        processedRows = Array.isArray(rows) ? rows : [];
        scheduleUpdate(true);
    }
    function setColumnsValue(next) {
        columns = Array.isArray(next) ? next : [];
        scheduleUpdate(true);
    }
    function setZoomValue(nextZoom) {
        const normalized = Number.isFinite(nextZoom) && nextZoom > 0 ? nextZoom : 1;
        if (normalized === zoom)
            return;
        zoom = normalized;
        const timestamp = clock.now();
        virtualization.resetOverscan(timestamp);
        horizontalOverscanController.reset(timestamp);
        scheduleUpdate(true);
    }
    function setVirtualizationEnabledValue(enabled) {
        const normalized = Boolean(enabled);
        if (virtualizationFlag === normalized)
            return;
        virtualizationFlag = normalized;
        scheduleUpdate(true);
    }
    function setRowHeightModeValue(mode) {
        if (rowHeightMode === mode)
            return;
        rowHeightMode = mode;
        scheduleUpdate(true);
    }
    function setBaseRowHeightValue(height) {
        const normalized = Number.isFinite(height) && height > 0 ? height : BASE_ROW_HEIGHT;
        if (baseRowHeight === normalized)
            return;
        baseRowHeight = normalized;
        scheduleUpdate(true);
    }
    function setViewportMetricsValue(metrics) {
        viewportMetrics = metrics;
        if (metrics) {
            const fallbackScrollWidth = cachedNativeScrollWidth >= 0 ? cachedNativeScrollWidth : metrics.containerWidth;
            const fallbackScrollHeight = cachedNativeScrollHeight >= 0 ? cachedNativeScrollHeight : metrics.containerHeight;
            layoutCache.updateContainer({
                clientWidth: metrics.containerWidth,
                clientHeight: metrics.containerHeight,
                scrollWidth: fallbackScrollWidth,
                scrollHeight: fallbackScrollHeight,
                scrollLeft: lastScrollLeftSample,
                scrollTop: lastScrollTopSample,
            }, null);
            layoutCache.updateHeader({ height: metrics.headerHeight });
            measureLayout();
        }
        scheduleUpdate(true);
    }
    function setIsLoadingValue(value) {
        loading = Boolean(value);
    }
    function setImperativeCallbacksValue(callbacks) {
        imperativeCallbacks = callbacks ?? {};
    }
    function setOnAfterScrollValue(callback) {
        onAfterScroll = callback ?? null;
    }
    function setOnNearBottomValue(callback) {
        onNearBottom = callback ?? null;
    }
    function setServerIntegrationValue(integration) {
        if (!integration) {
            serverIntegration = { rowModel: null, enabled: false };
        }
        else {
            serverIntegration = { ...integration };
        }
        virtualization.resetServerIntegration();
        scheduleUpdate(true);
    }
    function setDebugModeValue(enabled) {
        applyDebugMode(Boolean(enabled));
    }
    function handleScroll(event) {
        scrollIo.handleScroll(event);
    }
    function updateViewportHeightValue() {
        scheduleUpdate(true);
    }
    function measureRowHeightValue() {
        scheduleUpdate(true);
    }
    function cancelScrollRaf() {
        frameScheduler.cancel();
        scrollIo.cancelAfterScrollTask();
        cancelPendingHeavyUpdate();
        pendingForce = false;
        frameForce = false;
        pendingHorizontalSettle = false;
        horizontalOverscan = horizontalMinOverscan;
        const timestamp = clock.now();
        horizontalOverscanController.reset(timestamp);
        virtualization.resetOverscan(timestamp);
        cachedNativeScrollHeight = -1;
        cachedNativeScrollWidth = -1;
    }
    function scrollToRowValue(index) {
        const total = totalRowCount.value;
        if (total <= 0)
            return;
        const clampedIndex = clamp(index, 0, Math.max(total - 1, 0));
        const rawTarget = clampedIndex * effectiveRowHeight.value;
        const virtualizationActive = virtualizationEnabled.value || (virtualizationFlag && rowHeightMode === "fixed");
        let target;
        if (virtualizationActive) {
            // Allow the final row to align with the top edge when virtualization synthesizes scroll height.
            const alignLimit = Math.max(0, (total - 1) * effectiveRowHeight.value);
            target = Math.min(rawTarget, alignLimit);
            if (!Number.isFinite(target)) {
                target = 0;
            }
        }
        else {
            target = clampScrollTopValue(rawTarget);
        }
        pendingScrollTop = target;
        scheduleUpdate(true);
        flushSchedulers();
    }
    function scrollToColumnValue(key) {
        const map = columnWidthMap.value;
        if (!map.size)
            return;
        let offset = 0;
        for (const [columnKey, width] of map.entries()) {
            if (columnKey === key)
                break;
            offset += width;
        }
        pendingScrollLeft = Math.max(0, offset);
        scheduleUpdate(true);
    }
    function isRowVisibleValue(index) {
        return index >= startIndex.value && index <= endIndex.value;
    }
    function refreshValue(force) {
        scheduleUpdate(force === true);
        if (force === true) {
            flushSchedulers();
        }
    }
    function disposeValue() {
        detach();
        flushMeasurementQueue();
        disposeDiagnostics();
        if (ownsScheduler) {
            scheduler.dispose();
        }
        frameScheduler.dispose();
        disposeSignals();
    }
    function scheduleAfterScroll() {
        scrollIo.scheduleAfterScroll();
    }
    function updatePinnedOffsets(meta) {
        const nextPinnedLeft = Math.max(0, Number.isFinite(meta.indexColumnWidth) ? meta.indexColumnWidth : 0);
        const nextPinnedRight = Math.max(0, Number.isFinite(meta.pinnedRightWidth) ? meta.pinnedRightWidth : 0);
        const pendingUpdate = scrollSyncState.pinnedOffsetLeft !== nextPinnedLeft ||
            scrollSyncState.pinnedOffsetRight !== nextPinnedRight;
        if (!pendingUpdate) {
            return;
        }
        if (scrollSyncTargets) {
            const nextState = resolveViewportSyncNextState({
                pinnedOffsetLeft: nextPinnedLeft,
                pinnedOffsetRight: nextPinnedRight,
            });
            applyViewportSyncTransforms(scrollSyncTargets, scrollSyncState, nextState);
        }
        scrollSyncState.pinnedOffsetLeft = nextPinnedLeft;
        scrollSyncState.pinnedOffsetRight = nextPinnedRight;
    }
    function applyColumnSnapshot(meta, start, end, payload) {
        columnSnapshot.columnWidthMap = columnWidthMap.value;
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
                zoom: meta.zoom,
            },
            range: { start, end },
            payload,
            getColumnKey,
            resolveColumnWidth,
        });
        const visibleColumnsSnapshot = columnSnapshot.visibleColumns;
        visibleColumns.value = visibleColumnsSnapshot.map(entry => entry.column);
        visibleColumnEntries.value = visibleColumnsSnapshot.slice();
        const visibleScrollableSnapshot = columnSnapshot.visibleScrollable;
        visibleScrollableColumns.value = visibleScrollableSnapshot.map(entry => entry.column);
        visibleScrollableEntries.value = visibleScrollableSnapshot.slice();
        const pinnedLeftSnapshot = columnSnapshot.pinnedLeft;
        pinnedLeftColumns.value = pinnedLeftSnapshot.map(entry => entry.column);
        pinnedLeftEntries.value = pinnedLeftSnapshot.slice();
        const pinnedRightSnapshot = columnSnapshot.pinnedRight;
        pinnedRightColumns.value = pinnedRightSnapshot.map(entry => entry.column);
        pinnedRightEntries.value = pinnedRightSnapshot.slice();
        leftPadding.value = payload.leftPadding;
        rightPadding.value = payload.rightPadding;
        columnWidthMap.value = new Map(columnSnapshot.columnWidthMap);
        visibleStartCol.value = visibleStartIndex;
        visibleEndCol.value = visibleEndIndex;
        scrollableRange.value = { start, end };
        const columnState = columnVirtualState.value;
        columnState.start = start;
        columnState.end = end;
        columnState.visibleStart = payload.visibleStart;
        columnState.visibleEnd = payload.visibleEnd;
        columnState.overscanLeading = horizontalVirtualizer.getState().overscanLeading;
        columnState.overscanTrailing = horizontalVirtualizer.getState().overscanTrailing;
        columnState.poolSize = horizontalVirtualizer.getState().poolSize;
        columnState.visibleCount = horizontalVirtualizer.getState().visibleCount;
        columnState.totalCount = meta.scrollableColumns.length;
        columnState.indexColumnWidth = meta.indexColumnWidth;
        columnState.pinnedRightWidth = meta.pinnedRightWidth;
        columnVirtualState.value = { ...columnState };
        updatePinnedOffsets(meta);
    }
    function clampScrollTopValue(value) {
        return virtualization.clampScrollTop(value);
    }
    function clampScrollLeftValue(value) {
        if (!Number.isFinite(value))
            return 0;
        const containerRef = container;
        const nativeLimit = containerRef
            ? Math.max(0, containerRef.scrollWidth - containerRef.clientWidth)
            : cachedNativeScrollWidth >= 0 && cachedContainerWidth >= 0
                ? Math.max(0, cachedNativeScrollWidth - cachedContainerWidth)
                : null;
        const clampResult = clampHorizontalOffset(value, {
            ...horizontalClampContext,
            nativeScrollLimit: nativeLimit,
            virtualizationEnabled: virtualizationEnabled.value,
        });
        const normalized = clampResult.normalized;
        if (isDebugEnabled()) {
            console.debug("[UiTable] clampScrollLeftValue", {
                requested: value,
                normalized,
                nativeLimit: clampResult.nativeLimit,
                effectiveViewport: clampResult.effectiveViewport,
                trailingGap: clampResult.trailingGap,
                bufferPx: clampResult.bufferPx,
                maxScroll: clampResult.maxScroll,
            });
        }
        return normalized;
    }
    function logHorizontalDebug(payload) {
        if (!isDebugEnabled())
            return;
        const containerRef = container;
        const domStats = resolveDomStats(hostEnvironment, containerRef);
        console.debug("[UiTable][Horizontal]", {
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
        });
    }
    function runUpdate(force) {
        if (!heavyFramePending && !heavyFrameInProgress && !force && !pendingForce) {
            return;
        }
        if (heavyFrameInProgress) {
            pendingForce = pendingForce || force;
            heavyFramePending = true;
            frameScheduler.invalidate();
            return;
        }
        heavyFrameInProgress = true;
        heavyFramePending = false;
        try {
            const containerRef = container;
            if (!containerRef) {
                return;
            }
            const rows = processedRows;
            totalRowCount.value = rows.length;
            const virtualizationByProp = virtualizationFlag;
            const verticalVirtualizationEnabled = virtualizationByProp && rowHeightMode === "fixed";
            virtualizationEnabled.value = verticalVirtualizationEnabled;
            const zoomFactor = Math.max(zoom || 1, 0.01);
            const layoutScale = (options.supportsCssZoom ?? supportsCssZoom) ? zoomFactor : 1;
            const resolvedRowHeight = baseRowHeight * layoutScale;
            effectiveRowHeight.value = resolvedRowHeight;
            const metrics = viewportMetrics;
            const measurements = layoutMeasurement;
            let containerHeight = cachedContainerHeight;
            let containerWidthValue = cachedContainerWidth;
            let headerHeightValue = cachedHeaderHeight;
            if (metrics) {
                containerHeight = metrics.containerHeight;
                containerWidthValue = metrics.containerWidth;
                headerHeightValue = metrics.headerHeight;
            }
            else if (measurements) {
                containerHeight = measurements.containerHeight;
                containerWidthValue = measurements.containerWidth;
                headerHeightValue = measurements.headerHeight;
            }
            if (containerHeight <= 0) {
                containerHeight = cachedContainerHeight > 0 ? cachedContainerHeight : resolvedRowHeight;
            }
            if (containerWidthValue <= 0) {
                containerWidthValue = cachedContainerWidth > 0 ? cachedContainerWidth : columnSnapshot.containerWidthForColumns;
            }
            if (headerHeightValue < 0) {
                headerHeightValue = cachedHeaderHeight > 0 ? cachedHeaderHeight : 0;
            }
            const viewportHeightValue = Math.max(containerHeight - headerHeightValue, resolvedRowHeight);
            const viewportWidthValue = containerWidthValue;
            viewportHeight.value = viewportHeightValue;
            viewportWidth.value = viewportWidthValue;
            const pendingScrollTopRequest = pendingScrollTop;
            const pendingScrollLeftRequest = pendingScrollLeft;
            const snapshotScrollTop = measurements?.scrollTop;
            const snapshotScrollLeft = measurements?.scrollLeft;
            const fallbackScrollTop = Number.isFinite(snapshotScrollTop) ? snapshotScrollTop : lastScrollTopSample;
            const fallbackScrollLeft = Number.isFinite(snapshotScrollLeft) ? snapshotScrollLeft : lastScrollLeftSample;
            const normalizedFallbackScrollTop = Number.isFinite(fallbackScrollTop) ? fallbackScrollTop : 0;
            const normalizedFallbackScrollLeft = Number.isFinite(fallbackScrollLeft) ? fallbackScrollLeft : 0;
            const pendingTop = typeof pendingScrollTopRequest === "number" && Number.isFinite(pendingScrollTopRequest)
                ? pendingScrollTopRequest
                : normalizedFallbackScrollTop;
            const pendingLeft = typeof pendingScrollLeftRequest === "number" && Number.isFinite(pendingScrollLeftRequest)
                ? pendingScrollLeftRequest
                : normalizedFallbackScrollLeft;
            const measuredScrollTopFromPending = typeof pendingScrollTopRequest === "number";
            const measuredScrollLeftFromPending = typeof pendingScrollLeftRequest === "number";
            pendingScrollTop = null;
            pendingScrollLeft = null;
            const hadPendingScrollTop = pendingScrollTopRequest != null;
            const hadPendingScrollLeft = pendingScrollLeftRequest != null;
            const scrollTopDelta = Math.abs(pendingTop - lastScrollTopSample);
            const scrollLeftDelta = Math.abs(pendingLeft - lastScrollLeftSample);
            const shouldFastPath = !force &&
                !pendingHorizontalSettle &&
                !measuredScrollTopFromPending &&
                !measuredScrollLeftFromPending &&
                !hadPendingScrollTop &&
                !hadPendingScrollLeft &&
                scrollTopDelta <= verticalScrollEpsilon &&
                scrollLeftDelta <= horizontalScrollEpsilon;
            if (shouldFastPath) {
                scrollTop.value = lastScrollTopSample;
                scrollLeft.value = lastScrollLeftSample;
                pendingHorizontalSettle = false;
                scheduleAfterScroll();
                return;
            }
            recordHeavyPass();
            const virtualizationPrepared = virtualization.prepare({
                rows,
                totalRowCount: rows.length,
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
                serverIntegration,
                imperativeCallbacks,
            });
            if (!virtualizationPrepared) {
                recordVirtualizerSkip();
                scheduleAfterScroll();
                return;
            }
            recordVirtualizerUpdate();
            // Two-phase (A6): virtualization apply happens later with pending writes.
            let nextScrollTop = virtualizationPrepared.scrollTop;
            let syncScrollTopValue = virtualizationPrepared.syncedScrollTop;
            let syncScrollLeftValue = null;
            const nowTs = virtualizationPrepared.timestamp;
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
            });
            horizontalMetaVersion = horizontalMetaResult.version;
            lastHorizontalMetaSignature = horizontalMetaResult.signature;
            const columnMeta = horizontalMetaResult.meta;
            const totalPinnedWidth = columnMeta.pinnedLeftWidth + columnMeta.pinnedRightWidth + columnMeta.indexColumnWidth;
            const contentWidthEstimate = Math.max(columnMeta.metrics.totalWidth + totalPinnedWidth, viewportWidthValue);
            const contentHeightEstimate = Math.max(totalRowCount.value * resolvedRowHeight, viewportHeightValue);
            layoutCache.updateContentDimensions(contentWidthEstimate, contentHeightEstimate);
            const fallbackWidth = columnMeta.metrics.widths[0] ??
                columnMeta.pinnedLeft[0]?.width ??
                columnMeta.pinnedRight[0]?.width ??
                60;
            const averageColumnWidth = columnMeta.metrics.widths.length
                ? Math.max(1, columnMeta.metrics.totalWidth / Math.max(columnMeta.metrics.widths.length, 1))
                : Math.max(1, fallbackWidth);
            lastAverageColumnWidth = averageColumnWidth;
            horizontalClampContext = {
                totalScrollableWidth: columnMeta.metrics.totalWidth,
                containerWidthForColumns: columnMeta.containerWidthForColumns,
                pinnedLeftWidth: columnMeta.pinnedLeftWidth,
                pinnedRightWidth: columnMeta.pinnedRightWidth,
                averageColumnWidth,
                nativeScrollLimit: columnMeta.nativeScrollLimit,
                virtualizationEnabled: true,
            };
            const currentPendingLeft = Math.max(0, pendingLeft);
            const rawDeltaLeft = currentPendingLeft - lastScrollLeftSample;
            const deltaLeft = Math.abs(rawDeltaLeft);
            const horizontalDirection = rawDeltaLeft === 0 ? lastScrollDirection : rawDeltaLeft > 0 ? 1 : -1;
            const horizontalVirtualizationEnabled = true;
            const metaVersionChanged = columnMeta.version !== lastAppliedHorizontalMetaVersion;
            const horizontalUpdateForced = force || pendingScrollLeftRequest != null || measuredScrollLeftFromPending || metaVersionChanged;
            pendingHorizontalSettle = false;
            const horizontalCallbacks = {
                applyColumnSnapshot,
                logHorizontalDebug,
                onColumns: typeof imperativeCallbacks.onColumns === "function"
                    ? imperativeCallbacks.onColumns
                    : undefined,
            };
            // Two-phase (A6): compute horizontal plan without DOM writes.
            const horizontalPrepared = prepareHorizontalViewport({
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
            });
            const horizontalScrollLeftValue = horizontalPrepared.scrollLeftValue;
            if (horizontalPrepared.syncScrollLeftValue != null) {
                syncScrollLeftValue = horizontalPrepared.syncScrollLeftValue;
            }
            smoothedHorizontalVelocity = horizontalPrepared.smoothedHorizontalVelocity;
            horizontalOverscan = horizontalPrepared.horizontalOverscan;
            lastHorizontalSampleTime = horizontalPrepared.lastHorizontalSampleTime;
            lastScrollDirection = horizontalPrepared.lastScrollDirection;
            lastScrollLeftSample = horizontalPrepared.lastScrollLeftSample;
            lastAppliedHorizontalMetaVersion = horizontalPrepared.lastAppliedHorizontalMetaVersion;
            const virtualizationResult = virtualization.applyPrepared(virtualizationPrepared, {
                rows,
                serverIntegration,
                imperativeCallbacks,
            });
            const pendingVerticalScrollWrite = virtualizationResult.pendingScrollWrite;
            const pendingHorizontalScrollWrite = horizontalPrepared.pendingScrollWrite;
            applyHorizontalViewport({
                callbacks: horizontalCallbacks,
                prepared: horizontalPrepared,
            });
            const containerElement = containerRef;
            if (containerElement) {
                if (pendingVerticalScrollWrite != null &&
                    containerElement.scrollTop !== pendingVerticalScrollWrite) {
                    containerElement.scrollTop = pendingVerticalScrollWrite;
                    recordLayoutWrite();
                }
                if (pendingHorizontalScrollWrite != null &&
                    containerElement.scrollLeft !== pendingHorizontalScrollWrite) {
                    containerElement.scrollLeft = pendingHorizontalScrollWrite;
                    recordLayoutWrite();
                }
            }
            // Verified (A5): heavy path leaves pinned/header transforms to sync layer.
            scrollLeft.value = horizontalScrollLeftValue;
            nextScrollTop = virtualizationResult.scrollTop;
            syncScrollTopValue = virtualizationResult.syncedScrollTop;
            lastScrollTopSample = virtualizationResult.lastScrollTopSample;
            pendingScrollTop = virtualizationResult.pendingScrollTop;
            const resolvedScrollTop = syncScrollTopValue ?? nextScrollTop;
            const resolvedScrollLeft = syncScrollLeftValue ?? horizontalScrollLeftValue;
            updateCachedScrollOffsets(resolvedScrollTop, resolvedScrollLeft);
            lastHeavyScrollTop = resolvedScrollTop;
            lastHeavyScrollLeft = resolvedScrollLeft;
            emitImperativeScrollSync(resolvedScrollTop, resolvedScrollLeft, nowTs);
            if (onNearBottom && viewportHeightValue > 0 && totalRowCount.value > 0) {
                const threshold = Math.max(0, totalContentHeight.value - viewportHeightValue * 2);
                if (nextScrollTop >= threshold && !loading) {
                    onNearBottom();
                }
            }
            lastScrollTopSample = nextScrollTop;
            scheduleAfterScroll();
        }
        finally {
            heavyFrameInProgress = false;
        }
    }
    return {
        input,
        core,
        derived,
        attach,
        detach,
        setProcessedRows: setProcessedRowsValue,
        setColumns: setColumnsValue,
        setZoom: setZoomValue,
        setVirtualizationEnabled: setVirtualizationEnabledValue,
        setRowHeightMode: setRowHeightModeValue,
        setBaseRowHeight: setBaseRowHeightValue,
        setViewportMetrics: setViewportMetricsValue,
        setIsLoading: setIsLoadingValue,
        setImperativeCallbacks: setImperativeCallbacksValue,
        setOnAfterScroll: setOnAfterScrollValue,
        setOnNearBottom: setOnNearBottomValue,
        setServerIntegration: setServerIntegrationValue,
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
        refresh: refreshValue,
        dispose: disposeValue,
    };
}
