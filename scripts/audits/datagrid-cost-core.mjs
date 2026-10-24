/** Diagnostic cost benchmark. Build datagrid-core first. No product instrumentation is persisted. */
import { performance } from 'node:perf_hooks';
import { Session } from 'node:inspector';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd(), out = resolve(process.env.COST_OUTPUT ?? '/tmp/affino-cost-audit');
mkdirSync(out, { recursive: true });
const { createAdvancedClientRowModel } = await import(pathToFileURL(resolve(root, 'packages/datagrid-core/dist/src/models/clientRowModel.js')));
const { createDataGridColumnModel } = await import(pathToFileURL(resolve(root, 'packages/datagrid-core/dist/src/models/columnModel.js')));
const { createDataGridApi } = await import(pathToFileURL(resolve(root, 'packages/datagrid-core/dist/src/core/gridApi.js')));
const { createDataGridCore } = await import(pathToFileURL(resolve(root, 'packages/datagrid-core/dist/src/core/gridCore.js')));
const sizes = (process.env.COST_SIZES ?? '1000,5000,20000').split(',').map(Number);
const samples = Number(process.env.COST_SAMPLES ?? 30), warmups = 5;
const only = new Set((process.env.COST_ACTIONS ?? '').split(',').filter(Boolean)), profileOnly = process.env.COST_PROFILE_ONLY === '1';
const quantile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * p) - 1)] ?? 0;
const stats = xs => ({ samples: xs.length, medianMs: quantile(xs, .5), p95Ms: xs.length >= 20 ? quantile(xs, .95) : null, minMs: Math.min(...xs), maxMs: Math.max(...xs) });
const full = { recomputeFilter: true, recomputeSort: true, recomputeGroup: true };
const filter = threshold => ({ columnFilters: {}, advancedExpression: { kind: 'condition', key: 'value', operator: 'gt', value: threshold, type: 'number' } });
function make(n, kind, observed = false) {
    const work = { active: false, reads: 0, readRows: new Set(), byField: {}, computes: 0, stages: {}, events: 0, facadeEvents: 0, largeArrays: 0, largeArraySlots: 0, kindReads: 0, kindRows: new Set(), mapCopyEntries: 0, typedArrayBytes: 0, constructedArraySlots: 0 };
    const rows = Array.from({ length: n }, (_, i) => ({ id: i, value: i % 100, spare: 0, g: `g${i % 10}`, h: `h${Math.floor(i / 10) % 10}`, year: 2020 + i % 4, parent: i % 8 === 0 ? null : i - i % 8, path: Array.from({ length: 8 }, (_, d) => `${Math.floor(i / 8)}-${d}`) }));
    const computed = [];
    if (kind === 'chain' || kind === 'wide' || kind === 'dense') {
        const count = kind === 'chain' ? 3 : kind === 'wide' ? 32 : 16;
        for (let i = 0; i < count; i++) {
            const deps = kind === 'chain' ? (i ? [`computed:f${i - 1}`] : ['field:value']) : kind === 'dense' ? ['field:value', ...Array.from({ length: i }, (_, j) => `computed:f${j}`)] : ['field:value'];
            computed.push({ name: `f${i}`, deps, compute(c) { if (work.active)
                    work.computes++; return deps.reduce((s, d) => s + Number(c.get(d) ?? 0), 0) + 1; } });
        }
    }
    const options = { rows, resolveRowId: r => r.id, initialComputedFields: computed, projectionStageTimer: (stage, run) => { const start = performance.now(), result = run(), duration = performance.now() - start; if (work.active) {
            const s = work.stages[stage] ?? { calls: 0, ms: 0 };
            s.calls++;
            s.ms += duration;
            work.stages[stage] = s;
        } return { result, duration }; } };
    if (kind === 'formula')
        options.initialFormulaFields = [{ name: 'a', formula: 'value*2' }, { name: 'b', formula: 'a+1' }, { name: 'c', formula: 'b*2' }];
    if (kind === 'pivotEdit')
        options.initialPivotModel = { rows: ['g'], columns: ['year'], values: [{ field: 'value', agg: 'sum' }] };
    if (kind === 'sorted')
        options.initialSortModel = [{ key: 'value', direction: 'asc' }];
    if (kind === 'aggregate')
        Object.assign(options, { initialGroupBy: { fields: ['g'], expandedByDefault: true }, initialAggregationModel: { columns: [{ key: 'value', op: 'sum' }] } });
    if (kind === 'tree')
        Object.assign(options, { initialTreeData: { mode: 'path', getDataPath: r => r.path, dependencyFields: ['path'], expandedByDefault: true }, initialAggregationModel: { columns: [{ key: 'value', op: 'sum' }] } });
    const model = createAdvancedClientRowModel(options);
    const columns = createDataGridColumnModel({ columns: ['value', 'spare', 'g', 'h', 'year'].map(key => ({ key })) });
    let selection = null;
    const api = createDataGridApi({ core: createDataGridCore({ services: { rowModel: { name: 'rowModel', model }, columnModel: { name: 'columnModel', model: columns }, selection: { name: 'selection', getSelectionSnapshot: () => selection, setSelectionSnapshot: s => { selection = s; }, clearSelection: () => { selection = null; } } } }) });
    api.policy.setProjectionMode('excel-like');
    const off = model.subscribe(() => { if (work.active)
        work.events++; });
    const facadeOff = ['rows:changed', 'projection:recomputed', 'columns:changed', 'selection:changed'].map(name => api.events.on(name, () => { if (work.active)
        work.facadeEvents++; }));
    return { model, api, columns, rows, work, observeRows(action) {
            const nodes = new Set([...model.getSourceRows(), ...model.getRowsInRange({ start: 0, end: model.getRowCount() - 1 })]);
            for (const node of nodes) {
                let kind = node.kind;
                Object.defineProperty(node, 'kind', { enumerable: true, configurable: true, get() { if (work.active) {
                        work.kindReads++;
                        work.kindRows.add(node.rowId);
                    } return kind; }, set(next) { kind = next; } });
            }
            const mutates = /independent|chain|Chain|fanout|dense|Edit|paste|sequential|Sequential|Batch/.test(action);
            for (let i = 0; i < n; i++) {
                const row = model.getRowById(i)?.data;
                if (!row)
                    continue;
                for (const field of Object.keys(row)) {
                    if (mutates && (field === 'value' || field === 'spare'))
                        continue;
                    let value = row[field];
                    Object.defineProperty(row, field, { enumerable: true, configurable: true, get() { if (work.active) {
                            work.reads++;
                            work.readRows.add(i);
                            work.byField[field] = (work.byField[field] ?? 0) + 1;
                        } return value; }, set(next) { value = next; } });
                }
            }
        }, dispose: async () => { off(); for (const f of facadeOff)
            f(); await api.dispose(); model.dispose(); columns.dispose(); } };
}
const scenarios = {
    noop: { kind: 'flat', run: f => f.model.patchRows([{ rowId: 0, data: { spare: 0 } }], full) },
    treeDeltaEdit: { kind: 'tree', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }]) },
    pivotValueEdit: { kind: 'pivotEdit', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    sortedPatch20: { kind: 'sorted', run: (f, i) => f.model.patchRows(Array.from({ length: 20 }, (_, j) => ({ rowId: j, data: { value: 100 + i } })), full) },
    independent: { kind: 'flat', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { spare: i + 1 } }], full) },
    chain3: { kind: 'chain', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    formulaChain3: { kind: 'formula', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    fanout32: { kind: 'wide', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    dense16: { kind: 'dense', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    sort: { kind: 'flat', run: (f, i) => f.model.setSortModel([{ key: 'value', direction: i % 2 ? 'asc' : 'desc' }]) },
    filter: { kind: 'flat', run: (f, i) => f.model.setFilterModel(filter(i % 2 ? 40 : 60)) },
    group3: { kind: 'flat', prepare: f => f.model.setGroupBy(null), run: f => f.model.setGroupBy({ fields: ['g', 'h', 'year'], expandedByDefault: true }) },
    groupHigh: { kind: 'flat', prepare: f => f.model.setGroupBy(null), run: f => f.model.setGroupBy({ fields: ['id'], expandedByDefault: true }) },
    aggregateEdit: { kind: 'aggregate', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    treeDepth8Edit: { kind: 'tree', run: (f, i) => f.model.patchRows([{ rowId: 0, data: { value: 100 + i } }], full) },
    pivot: { kind: 'flat', prepare: f => f.model.setPivotModel(null), run: f => f.model.setPivotModel({ rows: ['g'], columns: ['year'], values: [{ field: 'value', agg: 'sum' }] }) },
    pivotHigh: { kind: 'flat', prepare: f => f.model.setPivotModel(null), run: f => f.model.setPivotModel({ rows: ['id'], columns: ['year'], values: [{ field: 'value', agg: 'sum' }] }) },
    append4: { kind: 'flat', prepare: f => f.model.setRows(f.rows), run: f => f.model.appendRows(Array.from({ length: 4 }, (_, i) => ({ id: `new${i}`, value: 9 }))) },
    remove4: { kind: 'flat', prepare: f => f.model.setRows(f.rows), run: f => f.model.removeRows([0, 1, 2, 3]) },
    summaryAll: { kind: 'flat', prepare: f => f.api.selection.setSnapshot({ ranges: [{ startRow: 0, endRow: f.rows.length - 1, startCol: 0, endCol: 4 }], activeCell: { rowIndex: 0, columnIndex: 0 }, activeRangeIndex: 0 }), run: f => f.api.selection.summarize() },
    selectionOne: { kind: 'flat', run: (f, i) => f.api.selection.setSnapshot({ ranges: [{ startRow: i % 2, endRow: i % 2, startCol: 0, endCol: 0 }], activeCell: { rowIndex: i % 2, columnIndex: 0 }, activeRangeIndex: 0 }) },
    selectionAll: { kind: 'flat', run: (f, i) => f.api.selection.setSnapshot({ ranges: [{ startRow: 0, endRow: f.rows.length - 1, startCol: 0, endCol: i % 2 ? 3 : 4 }], activeCell: { rowIndex: 0, columnIndex: 0 }, activeRangeIndex: 0 }) },
    resize: { kind: 'flat', run: (f, i) => f.api.columns.setWidth('value', 140 + i) },
    reorder: { kind: 'flat', run: (f, i) => f.api.columns.setOrder(i % 2 ? ['value', 'spare', 'g', 'h', 'year'] : ['year', 'h', 'g', 'spare', 'value']) },
    pin: { kind: 'flat', run: (f, i) => f.api.columns.setPin('value', i % 2 ? 'left' : 'none') },
    viewport: { kind: 'flat', run: (f, i) => f.model.setViewportRange({ start: i, end: i + 40 }) },
    paste100: { kind: 'flat', run: (f, i) => f.model.patchRows(Array.from({ length: 100 }, (_, j) => ({ rowId: j, data: { value: 100 + i, spare: 100 + i } })), full) },
    sequential20: { kind: 'flat', run: (f, i) => { for (let j = 0; j < 20; j++)
            f.model.patchRows([{ rowId: j, data: { value: 100 + i } }], full); } },
    modelBatch20: { kind: 'flat', run: (f, i) => f.model.batchMutations(() => { for (let j = 0; j < 20; j++)
            f.model.patchRows([{ rowId: j, data: { value: 100 + i } }], full); }) },
    facadeBatch20: { kind: 'flat', run: (f, i) => f.api.rows.batch(() => { for (let j = 0; j < 20; j++)
            f.api.rows.patch([{ rowId: j, data: { value: 100 + i } }], full); }) },
    sortedSequential20: { kind: 'sorted', run: (f, i) => { for (let j = 0; j < 20; j++)
            f.model.patchRows([{ rowId: j, data: { value: 100 + i } }], full); } },
    sortedModelBatch20: { kind: 'sorted', run: (f, i) => f.model.batchMutations(() => { for (let j = 0; j < 20; j++)
            f.model.patchRows([{ rowId: j, data: { value: 100 + i } }], full); }) },
    captureView: { kind: 'flat', run: f => f.api.read.captureView({ include: ['rows', 'columns', 'computed'] }) },
    captureClone: { kind: 'flat', run: f => f.api.read.captureView({ include: ['rows', 'columns', 'computed'], cloneRow: r => ({ ...r }) }) },
};
function reset(w) { w.reads = 0; w.readRows.clear(); w.byField = {}; w.computes = 0; w.stages = {}; w.events = 0; w.facadeEvents = 0; w.largeArrays = 0; w.largeArraySlots = 0; w.kindReads = 0; w.kindRows.clear(); w.mapCopyEntries = 0; w.typedArrayBytes = 0; w.constructedArraySlots = 0; }
function arrays(w) {
    const saved = {};
    for (const name of ['map', 'filter', 'slice']) {
        saved[name] = Array.prototype[name];
        Array.prototype[name] = function (...args) { const result = Reflect.apply(saved[name], this, args); if (w.active && result.length >= 128) {
            w.largeArrays++;
            w.largeArraySlots += result.length;
        } return result; };
    }
    const from = Array.from;
    Array.from = function (...args) { const result = Reflect.apply(from, Array, args); if (w.active && result.length >= 128) {
        w.largeArrays++;
        w.largeArraySlots += result.length;
    } return result; };
    const constructors = {};
    for (const name of ['Map', 'Uint8Array', 'Int32Array', 'Uint32Array']) {
        const Original = globalThis[name];
        constructors[name] = Original;
        globalThis[name] = new Proxy(Original, { construct(target, args, newTarget) { const result = Reflect.construct(target, args, newTarget); if (w.active) {
                if (name === 'Map' && args[0] instanceof Original)
                    w.mapCopyEntries += args[0].size;
                else if (name !== 'Map' && result.byteLength >= 128)
                    w.typedArrayBytes += result.byteLength;
            } return result; } });
    }
    return () => { Object.assign(Array.prototype, saved); Array.from = from; for (const [name, Original] of Object.entries(constructors))
        globalThis[name] = Original; };
}
const results = [];
for (const n of (profileOnly ? [] : sizes))
    for (const [name, scenario] of Object.entries(scenarios).filter(([name]) => !only.size || only.has(name))) {
        const f = make(n, scenario.kind);
        const times = [], stageTotals = {};
        let notifications = 0, recomputes = 0, formulaEvaluations = 0;
        for (let i = 0; i < warmups + samples; i++) {
            scenario.prepare?.(f);
            reset(f.work);
            const before = f.model.getSnapshot().projection?.recomputeVersion ?? 0;
            f.work.active = true;
            const start = performance.now();
            scenario.run(f, i);
            const elapsed = performance.now() - start;
            f.work.active = false;
            if (i >= warmups) {
                times.push(elapsed);
                notifications += f.work.events;
                recomputes += (f.model.getSnapshot().projection?.recomputeVersion ?? 0) - before;
                formulaEvaluations += scenario.kind === 'formula' ? f.model.getFormulaComputeStageDiagnostics().evaluations : 0;
                for (const [stage, v] of Object.entries(f.work.stages))
                    stageTotals[stage] = (stageTotals[stage] ?? 0) + v.ms;
            }
        }
        const source = f.model.getSourceRows();
        if (new Set(source.map(r => r.rowId)).size !== source.length)
            throw Error('duplicate source IDs');
        if (name === 'treeDeltaEdit' && f.model.getRow(0)?.groupMeta?.aggregates?.value !== 28 + 100 + warmups + samples - 1)
            throw Error('stale tree aggregate');
        if (name === 'formulaChain3' && f.model.getEffectiveRowById(0)?.data.c !== 4 * (100 + warmups + samples - 1) + 2)
            throw Error('stale formula chain');
        await f.dispose();
        const counted = make(n, scenario.kind, true);
        scenario.prepare?.(counted);
        counted.observeRows(name);
        reset(counted.work);
        const restore = arrays(counted.work);
        counted.work.active = true;
        scenario.run(counted, name === 'pin' ? 1001 : 1000);
        counted.work.active = false;
        restore();
        const w = counted.work;
        results.push({ n, action: name, ...stats(times), meanModelEvents: notifications / samples, meanRecomputeCycles: recomputes / samples, meanFormulaEvaluations: formulaEvaluations / samples, meanStagesMs: Object.fromEntries(Object.entries(stageTotals).map(([k, v]) => [k, v / samples])), counted: { rowNodeKindReads: w.kindReads, uniqueRowNodesRead: w.kindRows.size, mapCopyEntries: w.mapCopyEntries, typedArrayBytes: w.typedArrayBytes, fieldReads: w.reads, uniqueSourceRowsRead: w.readRows.size, byField: w.byField, computedCallbackEvaluations: w.computes, stageCalls: Object.fromEntries(Object.entries(w.stages).map(([k, v]) => [k, v.calls])), modelEvents: w.events, facadeEvents: w.facadeEvents, derivedCache: counted.model.getDerivedCacheDiagnostics(), largeArrayResults: w.largeArrays, largeArraySlots: w.largeArraySlots } });
        await counted.dispose();
    }
const cold = [];
for (const n of (profileOnly ? [] : sizes))
    for (const name of ['sort', 'filter', 'captureView'].filter(name => !only.size || only.has(name))) {
        const times = [];
        for (let i = 0; i < 10; i++) {
            const f = make(n, scenarios[name].kind);
            const start = performance.now();
            scenarios[name].run(f, 0);
            times.push(performance.now() - start);
            await f.dispose();
        }
        cold.push({ n, action: name, ...stats(times) });
    }
if (!profileOnly)
    writeFileSync(resolve(out, 'core-cost.json'), JSON.stringify({ cold, node: process.version, arch: process.arch, samples, warmups, largeArrayObservation: 'map/filter/slice/Array.from result lengths >=128; not all allocations', results }, null, 2));
// CPU and allocation profiles are separate from timing samples.
const session = new Session();
session.connect();
const post = (method, params = {}) => new Promise((res, rej) => session.post(method, params, (e, v) => e ? rej(e) : res(v)));
for (const name of ['independent', 'formulaChain3', 'captureView', 'modelBatch20'].filter(name => !only.size || only.has(name))) {
    const f = make(Math.max(...sizes), scenarios[name].kind);
    await post('Profiler.enable');
    await post('Profiler.start');
    await post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    for (let i = 0; i < 80; i++)
        scenarios[name].run(f, 2000 + i);
    const cpu = await post('Profiler.stop'), heap = await post('HeapProfiler.stopSampling');
    writeFileSync(resolve(out, `${name}.cpuprofile`), JSON.stringify(cpu.profile));
    writeFileSync(resolve(out, `${name}.heapprofile`), JSON.stringify(heap.profile));
    await f.dispose();
}
session.disconnect();
console.log(JSON.stringify({ output: out, scenarios: results.length, samplesEach: samples }));
