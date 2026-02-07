import { BASE_ROW_HEIGHT } from "../utils/constants";
function cloneInitial(source) {
    if (Array.isArray(source)) {
        return [];
    }
    if (source instanceof Map) {
        return new Map();
    }
    if (source && typeof source === "object") {
        return { ...source };
    }
    return source;
}
export function createTableViewportSignals(createSignal) {
    const resets = [];
    const track = (initial, factory) => {
        const signal = createSignal(initial);
        const resetFactory = factory ?? (() => cloneInitial(initial));
        resets.push(() => {
            signal.value = resetFactory();
        });
        return signal;
    };
    const columnVirtualStateFactory = () => ({
        start: 0,
        end: 0,
        visibleStart: 0,
        visibleEnd: 0,
        overscanLeading: 0,
        overscanTrailing: 0,
        poolSize: 0,
        visibleCount: 0,
        totalCount: 0,
        indexColumnWidth: 0,
        pinnedRightWidth: 0,
    });
    const input = {
        scrollTop: track(0),
        scrollLeft: track(0),
        viewportHeight: track(0),
        viewportWidth: track(0),
        virtualizationEnabled: track(true),
    };
    const core = {
        totalRowCount: track(0),
        effectiveRowHeight: track(BASE_ROW_HEIGHT),
        visibleCount: track(0),
        poolSize: track(0),
        totalContentHeight: track(0),
        startIndex: track(0),
        endIndex: track(0),
        overscanLeading: track(0),
        overscanTrailing: track(0),
    };
    const derivedRows = {
        visibleRange: track({ start: 0, end: 0 }, () => ({ start: 0, end: 0 })),
    };
    const derivedColumns = {
        visibleColumns: track([], () => []),
        visibleColumnEntries: track([], () => []),
        visibleScrollableColumns: track([], () => []),
        visibleScrollableEntries: track([], () => []),
        pinnedLeftColumns: track([], () => []),
        pinnedLeftEntries: track([], () => []),
        pinnedRightColumns: track([], () => []),
        pinnedRightEntries: track([], () => []),
        leftPadding: track(0),
        rightPadding: track(0),
        columnWidthMap: track(new Map(), () => new Map()),
        visibleStartCol: track(0),
        visibleEndCol: track(0),
        scrollableRange: track({ start: 0, end: 0 }, () => ({ start: 0, end: 0 })),
        columnVirtualState: track(columnVirtualStateFactory(), columnVirtualStateFactory),
    };
    const derivedMetrics = {
        debugMode: track(false),
        fps: track(0),
        frameTime: track(0),
        droppedFrames: track(0),
        layoutReads: track(0),
        layoutWrites: track(0),
        syncScrollRate: track(0),
        heavyUpdateRate: track(0),
        virtualizerUpdates: track(0),
        virtualizerSkips: track(0),
    };
    const derived = {
        rows: derivedRows,
        columns: derivedColumns,
        metrics: derivedMetrics,
    };
    return {
        input,
        core,
        derived,
        dispose: () => {
            for (const reset of resets) {
                reset();
            }
        },
    };
}
