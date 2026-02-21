export function useDataGridAxisAutoScrollDelta(options) {
    const maxIntensity = options.maxIntensity ?? 2;
    function resolveAxisAutoScrollDelta(pointer, min, max) {
        if (max <= min || options.edgePx <= 0 || options.maxStepPx <= 0) {
            return 0;
        }
        if (pointer < min + options.edgePx) {
            const intensity = Math.min(maxIntensity, (min + options.edgePx - pointer) / options.edgePx);
            return -Math.ceil(options.maxStepPx * intensity);
        }
        if (pointer > max - options.edgePx) {
            const intensity = Math.min(maxIntensity, (pointer - (max - options.edgePx)) / options.edgePx);
            return Math.ceil(options.maxStepPx * intensity);
        }
        return 0;
    }
    return {
        resolveAxisAutoScrollDelta,
    };
}
