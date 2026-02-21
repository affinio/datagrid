const CANONICAL_STARTUP_ORDER = [
    "event",
    "rowModel",
    "columnModel",
    "edit",
    "transaction",
    "selection",
    "viewport",
];
function createNoopService(name) {
    return { name };
}
function resolveStartupOrder(order) {
    if (!Array.isArray(order) || order.length === 0) {
        return [...CANONICAL_STARTUP_ORDER];
    }
    const seen = new Set();
    const resolved = [];
    for (const name of order) {
        if (!CANONICAL_STARTUP_ORDER.includes(name) || seen.has(name)) {
            continue;
        }
        seen.add(name);
        resolved.push(name);
    }
    for (const name of CANONICAL_STARTUP_ORDER) {
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);
        resolved.push(name);
    }
    return resolved;
}
function resolveServices(services) {
    const resolved = {};
    for (const name of CANONICAL_STARTUP_ORDER) {
        const candidate = services?.[name];
        if (!candidate) {
            resolved[name] = createNoopService(name);
            continue;
        }
        if (candidate.name !== name) {
            throw new Error(`[DataGridCore] service key "${name}" must match service.name "${candidate.name}".`);
        }
        resolved[name] = candidate;
    }
    return resolved;
}
export function createDataGridCore(options = {}) {
    const services = resolveServices(options.services);
    const startupOrder = resolveStartupOrder(options.startupOrder);
    let state = "idle";
    const context = {
        get state() {
            return state;
        },
        getService(name) {
            return services[name];
        },
    };
    async function runInOrder(method, order) {
        for (const name of order) {
            const service = services[name];
            const handler = service[method];
            if (!handler) {
                continue;
            }
            await handler(context);
        }
    }
    async function runInReverseOrder(method, order) {
        for (let index = order.length - 1; index >= 0; index -= 1) {
            const service = services[order[index]];
            const handler = service[method];
            if (!handler) {
                continue;
            }
            await handler(context);
        }
    }
    async function initCore() {
        if (state === "disposed") {
            throw new Error("[DataGridCore] cannot init disposed core.");
        }
        if (state === "initialized" || state === "started" || state === "stopped") {
            return;
        }
        await runInOrder("init", startupOrder);
        state = "initialized";
    }
    async function startCore() {
        if (state === "disposed") {
            throw new Error("[DataGridCore] cannot start disposed core.");
        }
        if (state === "started") {
            return;
        }
        await initCore();
        await runInOrder("start", startupOrder);
        state = "started";
    }
    async function stopCore() {
        if (state === "disposed" || state === "idle" || state === "stopped") {
            return;
        }
        await runInReverseOrder("stop", startupOrder);
        state = "stopped";
    }
    async function disposeCore() {
        if (state === "disposed") {
            return;
        }
        await stopCore();
        await runInReverseOrder("dispose", startupOrder);
        state = "disposed";
    }
    return {
        lifecycle: {
            get state() {
                return state;
            },
            startupOrder,
        },
        services,
        init: initCore,
        start: startCore,
        stop: stopCore,
        dispose: disposeCore,
        getService(name) {
            return services[name];
        },
    };
}
