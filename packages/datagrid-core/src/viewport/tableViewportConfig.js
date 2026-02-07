const GLOBAL_FALLBACK = typeof globalThis !== "undefined" ? globalThis : {};
export function createMonotonicClock(globalRef = GLOBAL_FALLBACK) {
    const performanceRef = globalRef.performance;
    if (performanceRef && typeof performanceRef.now === "function") {
        return {
            now: () => performanceRef.now(),
        };
    }
    const DateCtor = globalRef.Date ?? Date;
    return {
        now: () => new DateCtor().getTime(),
    };
}
function createDomResizeObserverFactory(globalRef) {
    return callback => {
        const ResizeObserverRef = globalRef.ResizeObserver;
        if (typeof ResizeObserverRef !== "function") {
            return null;
        }
        const observer = new ResizeObserverRef(() => callback());
        return {
            observe(target) {
                observer.observe(target);
            },
            unobserve(target) {
                if (typeof observer.unobserve === "function") {
                    observer.unobserve(target);
                }
            },
            disconnect() {
                observer.disconnect();
            },
        };
    };
}
export function createNoopResizeObserver() {
    return {
        observe() {
            // no-op
        },
        disconnect() {
            // no-op
        },
    };
}
function readDomContainerMetrics(target, _globalRef) {
    if (!target)
        return null;
    const scrollTop = Number.isFinite(target.scrollTop) ? target.scrollTop : 0;
    const scrollLeft = Number.isFinite(target.scrollLeft) ? target.scrollLeft : 0;
    const clientHeight = Number.isFinite(target.clientHeight) ? target.clientHeight : 0;
    const clientWidth = Number.isFinite(target.clientWidth) ? target.clientWidth : 0;
    const scrollHeight = Number.isFinite(target.scrollHeight) ? target.scrollHeight : 0;
    const scrollWidth = Number.isFinite(target.scrollWidth) ? target.scrollWidth : 0;
    return {
        clientHeight,
        clientWidth,
        scrollHeight,
        scrollWidth,
        scrollTop,
        scrollLeft,
    };
}
function readDomHeaderMetrics(target) {
    if (!target) {
        return { height: 0 };
    }
    const height = Number.isFinite(target.offsetHeight) ? target.offsetHeight : 0;
    return { height };
}
function getDomBoundingClientRect(target) {
    if (!target || typeof target.getBoundingClientRect !== "function") {
        return null;
    }
    const rect = target.getBoundingClientRect();
    if (!rect)
        return null;
    return rect;
}
function normalizeDomScrollLeft(target) {
    if (!target)
        return 0;
    const raw = target.scrollLeft;
    if (!Number.isFinite(raw)) {
        return 0;
    }
    if (raw >= 0) {
        return raw;
    }
    const dirAttribute = target.dir || target.getAttribute("dir");
    const documentDir = target.ownerDocument?.dir;
    const direction = (dirAttribute || documentDir || "").toLowerCase();
    if (direction !== "rtl") {
        return raw;
    }
    const maxOffset = target.scrollWidth - target.clientWidth;
    if (!Number.isFinite(maxOffset)) {
        return 0;
    }
    const normalized = maxOffset + raw;
    return normalized >= 0 ? normalized : 0;
}
function isDomEventFromContainer(event, container) {
    if (!container || !event)
        return false;
    if (event.currentTarget !== container) {
        return false;
    }
    if (event.target === container) {
        return true;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : null;
    if (!Array.isArray(path)) {
        return false;
    }
    return path.includes(container);
}
function queryDomStats(container) {
    if (!container?.querySelectorAll) {
        return null;
    }
    const rowLayers = container.querySelectorAll(".ui-table__row-layer").length;
    const cells = container.querySelectorAll(".ui-table__row-layer .ui-table-cell").length;
    const fillers = container.querySelectorAll(".ui-table__column-filler").length;
    return {
        rowLayers,
        cells,
        fillers,
    };
}
export function createDefaultHostEnvironment(globalRef = GLOBAL_FALLBACK, options) {
    const scrollOptions = options?.scrollListenerOptions ?? { passive: true };
    const removeOptions = options?.scrollRemoveOptions;
    const resizeObserverFactory = options?.resizeObserverFactory ?? createDomResizeObserverFactory(globalRef);
    return {
        addScrollListener(target, listener, listenerOptions) {
            const addEventListener = target?.addEventListener;
            if (typeof addEventListener === "function") {
                addEventListener.call(target, "scroll", listener, listenerOptions ?? scrollOptions);
            }
        },
        removeScrollListener(target, listener, listenerOptions) {
            const removeEventListener = target?.removeEventListener;
            if (typeof removeEventListener === "function") {
                const effectiveOptions = listenerOptions ?? removeOptions;
                if (effectiveOptions !== undefined) {
                    removeEventListener.call(target, "scroll", listener, effectiveOptions);
                }
                else {
                    removeEventListener.call(target, "scroll", listener);
                }
            }
        },
        createResizeObserver(callback) {
            return resizeObserverFactory(callback);
        },
        removeResizeObserverTarget(observer, target) {
            if (typeof observer.unobserve === "function") {
                observer.unobserve(target);
            }
            else {
                observer.disconnect();
            }
        },
        readContainerMetrics(target) {
            return readDomContainerMetrics(target, globalRef);
        },
        readHeaderMetrics(target) {
            return readDomHeaderMetrics(target);
        },
        getBoundingClientRect(target) {
            return getDomBoundingClientRect(target);
        },
        normalizeScrollLeft(target) {
            return normalizeDomScrollLeft(target);
        },
        isEventFromContainer(event, container) {
            return isDomEventFromContainer(event, container);
        },
        queryDebugDomStats(container) {
            return queryDomStats(container);
        },
    };
}
