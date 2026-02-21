export function sampleContainerMetrics(hostEnvironment, recordLayoutRead, container) {
    recordLayoutRead(4);
    const metrics = hostEnvironment.readContainerMetrics?.(container);
    if (metrics) {
        return metrics;
    }
    return {
        clientHeight: Number.isFinite(container.clientHeight) ? container.clientHeight : 0,
        clientWidth: Number.isFinite(container.clientWidth) ? container.clientWidth : 0,
        scrollHeight: Number.isFinite(container.scrollHeight) ? container.scrollHeight : 0,
        scrollWidth: Number.isFinite(container.scrollWidth) ? container.scrollWidth : 0,
        scrollTop: Number.isFinite(container.scrollTop) ? container.scrollTop : 0,
        scrollLeft: typeof hostEnvironment.normalizeScrollLeft === "function"
            ? hostEnvironment.normalizeScrollLeft(container)
            : Number.isFinite(container.scrollLeft)
                ? container.scrollLeft
                : 0,
    };
}
export function sampleHeaderHeight(hostEnvironment, recordLayoutRead, header) {
    recordLayoutRead();
    const metrics = hostEnvironment.readHeaderMetrics?.(header);
    if (metrics) {
        return metrics.height;
    }
    if (!header) {
        return 0;
    }
    return Number.isFinite(header.offsetHeight) ? header.offsetHeight : 0;
}
export function sampleBoundingRect(hostEnvironment, recordLayoutRead, target) {
    recordLayoutRead();
    const resolved = hostEnvironment.getBoundingClientRect?.(target);
    if (resolved) {
        return resolved;
    }
    return typeof target.getBoundingClientRect === "function" ? target.getBoundingClientRect() : null;
}
export function resolveDomStats(hostEnvironment, container) {
    if (!container) {
        return { rowLayers: 0, cells: 0, fillers: 0 };
    }
    const stats = hostEnvironment.queryDebugDomStats?.(container);
    if (stats) {
        return stats;
    }
    const query = container.querySelectorAll?.bind(container);
    if (!query) {
        return { rowLayers: 0, cells: 0, fillers: 0 };
    }
    return {
        rowLayers: query(".datagrid__row-layer").length,
        cells: query(".datagrid__row-layer .datagrid-cell").length,
        fillers: query(".datagrid__column-filler").length,
    };
}
export function sampleVisibleRowHeights(hostEnvironment, recordLayoutRead, container, range) {
    if (!container) {
        return [];
    }
    recordLayoutRead();
    const fromHost = hostEnvironment.readVisibleRowHeights?.(container, range);
    if (Array.isArray(fromHost)) {
        return fromHost;
    }
    const nodes = container.querySelectorAll?.("[data-row-index]");
    if (!nodes || nodes.length === 0) {
        return [];
    }
    const rangeStart = Math.max(0, Math.trunc(range.start));
    const rangeEnd = Math.max(rangeStart, Math.trunc(range.end));
    const samples = [];
    nodes.forEach(node => {
        const indexRaw = node.getAttribute("data-row-index");
        if (!indexRaw) {
            return;
        }
        const index = Number.parseInt(indexRaw, 10);
        if (!Number.isFinite(index) || index < rangeStart || index > rangeEnd) {
            return;
        }
        const height = Number.isFinite(node.offsetHeight) && node.offsetHeight > 0
            ? node.offsetHeight
            : typeof node.getBoundingClientRect === "function"
                ? node.getBoundingClientRect().height
                : 0;
        if (!Number.isFinite(height) || height <= 0) {
            return;
        }
        samples.push({ index, height });
    });
    return samples;
}
