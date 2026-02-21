export function resolveDataGridHeaderScrollSyncLeft(headerScrollLeft, bodyScrollLeft) {
    const resolvedHeader = Number.isFinite(headerScrollLeft) ? headerScrollLeft : 0;
    const resolvedBody = Number.isFinite(bodyScrollLeft) ? bodyScrollLeft : 0;
    if (resolvedHeader === resolvedBody) {
        return resolvedHeader;
    }
    return resolvedBody;
}
export function resolveDataGridHeaderLayerViewportGeometry(input) {
    const headerViewportHeight = Math.max(0, Number(input.headerViewportHeight) || 0);
    const bodyViewportWidth = Math.max(0, Number(input.bodyViewportWidth) || 0);
    const bodyViewportHeight = Math.max(0, Number(input.bodyViewportHeight) || 0);
    return {
        overlayTop: headerViewportHeight,
        overlayWidth: bodyViewportWidth,
        overlayHeight: bodyViewportHeight,
    };
}
