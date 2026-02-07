export function createMeasurementQueue(options = {}) {
    const globalObject = options.globalObject ?? (typeof window !== "undefined" ? window : globalThis);
    const rafRef = globalObject.requestAnimationFrame;
    const cafRef = globalObject.cancelAnimationFrame;
    let rafHandle = null;
    const jobs = [];
    let disposed = false;
    function flushJobs() {
        if (!jobs.length)
            return;
        const pending = jobs.splice(0, jobs.length);
        for (const job of pending) {
            if (job.cancelled())
                continue;
            try {
                const value = job.measure();
                job.resolve(value);
            }
            catch (error) {
                job.reject(error);
            }
        }
    }
    function ensureFrame() {
        if (disposed)
            return;
        if (rafHandle !== null)
            return;
        if (typeof rafRef !== "function") {
            flushJobs();
            return;
        }
        rafHandle = rafRef.call(globalObject, () => {
            rafHandle = null;
            flushJobs();
        });
    }
    function schedule(measure) {
        if (disposed || typeof rafRef !== "function") {
            const value = measure();
            return {
                promise: Promise.resolve(value),
                cancel() {
                    // no-op once resolved synchronously
                },
            };
        }
        let cancelled = false;
        const handle = {
            promise: new Promise((resolve, reject) => {
                jobs.push({
                    measure: measure,
                    resolve: value => resolve(value),
                    reject,
                    cancelled: () => cancelled,
                });
                ensureFrame();
            }),
            cancel() {
                cancelled = true;
            },
        };
        return handle;
    }
    function flush() {
        if (rafHandle !== null && typeof cafRef === "function") {
            cafRef.call(globalObject, rafHandle);
        }
        rafHandle = null;
        flushJobs();
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        if (rafHandle !== null && typeof cafRef === "function") {
            cafRef.call(globalObject, rafHandle);
        }
        rafHandle = null;
        flushJobs();
    }
    return {
        schedule,
        flush,
        dispose,
    };
}
const defaultMeasurementQueue = createMeasurementQueue();
export function scheduleMeasurement(measure) {
    return defaultMeasurementQueue.schedule(measure);
}
export function flushMeasurements() {
    defaultMeasurementQueue.flush();
}
export function disposeDefaultMeasurementQueue() {
    defaultMeasurementQueue.dispose();
}
