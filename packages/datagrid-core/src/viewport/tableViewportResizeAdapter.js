export function createManagedResizeObserver(hostEnvironment, callback) {
    const rawObserver = hostEnvironment.createResizeObserver?.(callback);
    if (!rawObserver) {
        return null;
    }
    const observedTargets = new Set();
    const unobserveTarget = (target) => {
        if (!observedTargets.has(target)) {
            return;
        }
        hostEnvironment.removeResizeObserverTarget?.(rawObserver, target);
        rawObserver.unobserve?.(target);
        observedTargets.delete(target);
    };
    const adapter = {
        observe(target) {
            if (observedTargets.has(target)) {
                return;
            }
            observedTargets.add(target);
            rawObserver.observe(target);
        },
        unobserve(target) {
            unobserveTarget(target);
        },
        disconnect() {
            for (const target of observedTargets) {
                hostEnvironment.removeResizeObserverTarget?.(rawObserver, target);
                rawObserver.unobserve?.(target);
            }
            observedTargets.clear();
            rawObserver.disconnect();
        },
    };
    return adapter;
}
