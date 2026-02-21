function normalizeDimension(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, value);
}
export function buildDataGridOverlayTransform(input) {
    const viewportWidth = normalizeDimension(input.viewportWidth);
    const pinnedOffsetLeft = normalizeDimension(input.pinnedOffsetLeft ?? 0);
    const pinnedOffsetRight = normalizeDimension(input.pinnedOffsetRight ?? 0);
    const maxRightInset = Math.max(0, viewportWidth - pinnedOffsetLeft);
    const rightInset = Math.min(pinnedOffsetRight, maxRightInset);
    return {
        transform: `translate3d(${-input.scrollLeft}px, ${-input.scrollTop}px, 0)`,
        clipPath: `inset(0px ${rightInset}px 0px ${pinnedOffsetLeft}px)`,
        willChange: "transform",
    };
}
export function buildDataGridOverlayTransformFromSnapshot(snapshot) {
    return buildDataGridOverlayTransform(snapshot);
}
