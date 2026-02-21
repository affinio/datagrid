export function createClientRowLifecycle() {
    let disposed = false;
    const listeners = new Set();
    return {
        ensureActive: () => {
            if (disposed) {
                throw new Error("ClientRowModel has been disposed");
            }
        },
        emit: (getSnapshot) => {
            if (disposed || listeners.size === 0) {
                return;
            }
            const snapshot = getSnapshot();
            for (const listener of listeners) {
                listener(snapshot);
            }
        },
        subscribe: (listener) => {
            if (disposed) {
                return () => { };
            }
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        dispose: () => {
            if (disposed) {
                return false;
            }
            disposed = true;
            listeners.clear();
            return true;
        },
        isDisposed: () => disposed,
    };
}
