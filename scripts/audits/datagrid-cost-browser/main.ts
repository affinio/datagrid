// Consumer-only diagnostic fixture. Production code is imported without changes.
import { createApp, h, ref, nextTick } from 'vue';
import DataGrid from '../../../packages/datagrid-vue/src/app-layer/DataGrid.ts';
import { createAdvancedClientRowModel } from '../../../packages/datagrid-core/src/models/clientRowModel.ts';
import { exportDataGridXlsx } from '../../../packages/datagrid-vue/src/app-layer/exportDataGridXlsx.ts';
let app: any, raw: any, grid = ref<any>(null), n = 0, c = 0, observed = false, iteration = 0, baseRows: any[] = [];
let observedKinds = new WeakSet<object>();
let active = false, work: any = {}, restores: Array<() => void> = [];
const api = () => grid.value.getApi();
const stable = async () => { await nextTick(); await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); await nextTick(); };
function clear() { work = { createdElements: 0, createdTextNodes: 0, renderPasses: 0, geometryReads: 0, geometryByMethod: {}, modelReads: {}, modelRowSlots: 0, events: {}, stages: {}, exportCells: 0, nodeKindReads: 0, readCallerSamples: [], addedNodes: 0, removedNodes: 0 }; }
const observer = new MutationObserver(records => { if (active)
    for (const r of records) {
        work.addedNodes += r.addedNodes.length;
        work.removedNodes += r.removedNodes.length;
    } });
observer.observe(document.getElementById('app')!, { childList: true, subtree: true });
function observePlatform() {
    for (const [owner, name] of [[Document.prototype, 'createElement'], [Document.prototype, 'createTextNode'], [Element.prototype, 'getBoundingClientRect']] as any) {
        const original = owner[name];
        owner[name] = function (...args: any[]) { if (active) {
            if (name === 'createElement')
                work.createdElements++;
            else if (name === 'createTextNode')
                work.createdTextNodes++;
            else {
                work.geometryReads++;
                work.geometryByMethod[name] = (work.geometryByMethod[name] ?? 0) + 1;
            }
        } return Reflect.apply(original, this, args); };
        restores.push(() => owner[name] = original);
    }
    for (const owner of [Element.prototype, HTMLElement.prototype])
        for (const key of ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight', 'offsetWidth', 'offsetHeight']) {
            const d = Object.getOwnPropertyDescriptor(owner, key);
            if (d?.get && d.configurable) {
                Object.defineProperty(owner, key, { ...d, get() { if (active) {
                        work.geometryReads++;
                        work.geometryByMethod[key] = (work.geometryByMethod[key] ?? 0) + 1;
                    } return d.get!.call(this); } });
                restores.push(() => Object.defineProperty(owner, key, d));
            }
        }
}
function observeKinds() { for (const node of new Set([...raw.getSourceRows(), ...raw.getRowsInRange({ start: 0, end: raw.getRowCount() - 1 })])) {
    if (observedKinds.has(node))
        continue;
    observedKinds.add(node);
    let kind = node.kind;
    Object.defineProperty(node, 'kind', { enumerable: true, configurable: true, get() { if (active)
            work.nodeKindReads++; return kind; }, set(v) { kind = v; } });
} }
async function mount(rows: number, columns: number, counted = false) {
    active = false;
    app?.unmount();
    raw?.dispose();
    for (const restore of restores)
        restore();
    restores = [];
    document.getElementById('app')!.replaceChildren();
    n = rows;
    c = columns;
    observed = counted;
    iteration = 0;
    grid = ref(null);
    observedKinds = new WeakSet();
    const source = Array.from({ length: n }, (_, i) => { const r: any = { rowId: `r${i}`, value: i % 100, g: `G${i % 10}`, year: 2020 + i % 4 }; for (let j = 1; j < c; j++)
        r[`c${j}`] = i + j; return r; });
    baseRows = source;
    raw = createAdvancedClientRowModel({ rows: source, resolveRowId: (r: any) => r.rowId, projectionStageTimer: (stage, run) => { const t = performance.now(), result = run(), duration = performance.now() - t; if (active) {
            const v = work.stages[stage] ?? { calls: 0, ms: 0 };
            v.calls++;
            v.ms += duration;
            work.stages[stage] = v;
        } return { result, duration }; } });
    const model = counted ? new Proxy(raw, { get(target, key) { const value = target[key]; if (typeof value !== 'function')
            return value; return (...args: any[]) => { const result = value.apply(target, args); if (active && ['getRow', 'getRowsInRange', 'getRowById', 'getEffectiveRowById', 'getSourceRows'].includes(String(key))) {
            work.modelReads[key] = (work.modelReads[key] ?? 0) + 1;
            work.modelRowSlots += Array.isArray(result) ? result.length : result ? 1 : 0;
            if (key === 'getRow' && args[0] === Math.floor(n / 2) && work.readCallerSamples.length < 5)
                work.readCallerSamples.push(new Error().stack);
        } return result; }; } }) : raw;
    const defs = Array.from({ length: c }, (_, j) => { const key = j ? `c${j}` : 'value'; return { key, label: key, width: 125, cellType: 'number', ...(counted ? { export: { value: ({ row }: any) => { if (active)
                    work.exportCells++; return row[key]; } } } : {}) }; });
    app = createApp({ render: () => h(DataGrid, { ref: grid, rows: source, rowModel: model, columns: defs, virtualization: { rows: true, columns: true, rowOverscan: 8, columnOverscan: 2 }, isCellEditable: () => true, fillHandle: true }) });
    if (counted)
        app.mixin({ beforeUpdate() { if (active)
                work.renderPasses++; } });
    app.mount('#app');
    for (let k = 0; k < 6; k++)
        await stable();
    if (raw.getRowCount() !== n)
        throw Error('fixture source rows were replaced');
    api().policy.setProjectionMode('excel-like');
    api().rows.setAutoReapply(true);
    if (counted) {
        observeKinds();
        observePlatform();
        for (const event of ['rows:changed', 'projection:recomputed', 'columns:changed', 'selection:changed'])
            api().events.on(event, () => { if (active)
                work.events[event] = (work.events[event] ?? 0) + 1; });
    }
    clear();
    return { n, c, prod: import.meta.env.PROD, mountedCells: document.querySelectorAll('.grid-cell').length, sourceRows: raw.getRowCount() };
}
const cell = (id = 'r0', key = 'value') => document.querySelector(`.grid-body-viewport .grid-cell[data-row-id="${id}"][data-column-key="${key}"]`) as HTMLElement | null;
async function prepare(action: string) {
    if (action === 'append4' || action === 'remove4') {
        raw.setRows(baseRows);
        await stable();
    }
    if (action === 'group') {
        raw.setGroupBy(null);
        await stable();
    }
    if (action === 'pivot') {
        raw.setPivotModel(null);
        await stable();
    }
    if (action === 'aggregateEdit') {
        raw.setGroupBy({ fields: ['g'], expandedByDefault: true });
        raw.setAggregationModel({ columns: [{ key: 'value', op: 'sum' }] });
        await stable();
    }
    const editor = document.querySelector('.cell-editor-input');
    if (editor) {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await stable();
    }
    if (action === 'paste') {
        const selected = await api().view.activateCell({ rowId: 'r0', columnKey: 'value' }, { selection: 'replace', focus: true });
        if (selected.status !== 'activated')
            throw Error('paste activation failed');
        await navigator.clipboard.writeText(Array.from({ length: 10 }, () => Array.from({ length: 4 }, () => String(1000 + iteration)).join('\t')).join('\n'));
        await stable();
    }
}
async function action(name: string) {
    const i = ++iteration, a = api();
    if (name === 'sort')
        return a.rows.setSortModel([{ key: 'value', direction: i % 2 ? 'desc' : 'asc' }]);
    if (name === 'filter')
        return a.rows.setFilterModel({ columnFilters: {}, advancedExpression: { kind: 'condition', key: 'value', operator: 'gt', type: 'number', value: i % 2 ? 40 : 60 } });
    if (name === 'group')
        return a.rows.setGroupBy({ fields: ['g', 'year'], expandedByDefault: true });
    if (name === 'pivot')
        return a.pivot.setModel({ rows: ['g'], columns: ['year'], values: [{ field: 'value', agg: 'sum' }] });
    if (name === 'aggregateEdit')
        return a.rows.applyEdits([{ rowId: 'r0', data: { value: 1000 + i } }], { reapply: true });
    if (name === 'append4')
        return raw.appendRows(Array.from({ length: 4 }, (_, j) => ({ rowId: `new${j}`, value: 10 })));
    if (name === 'remove4')
        return raw.removeRows(['r0', 'r1', 'r2', 'r3']);
    if (name === 'edit')
        return a.rows.applyEdits([{ rowId: 'r0', data: { value: 1000 + i } }], { reapply: true });
    if (name === 'selectOne')
        return a.selection.setSnapshot({ ranges: [{ startRow: i % 2, endRow: i % 2, startCol: 0, endCol: 0 }], activeCell: { rowIndex: i % 2, columnIndex: 0 }, activeRangeIndex: 0 });
    if (name === 'selectAll')
        return a.selection.setSnapshot({ ranges: [{ startRow: 0, endRow: n - 1, startCol: 0, endCol: c - 1 - i % 2 }], activeCell: { rowIndex: 0, columnIndex: 0 }, activeRangeIndex: 0 });
    if (name === 'resize')
        return a.columns.setWidth('value', 125 + i % 30);
    if (name === 'reorder')
        return a.columns.setOrder(i % 2 ? ['value', ...Array.from({ length: c - 1 }, (_, j) => `c${c - 1 - j}`)] : Array.from({ length: c }, (_, j) => j ? `c${j}` : 'value'));
    if (name === 'pin')
        return a.columns.setPin('value', i % 2 ? 'left' : 'none');
    if (name === 'editor') {
        const el = cell();
        if (!el)
            throw Error('missing editor cell');
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await nextTick();
        if (!document.querySelector('.cell-editor-input'))
            throw Error('editor did not open');
        return;
    }
    if (name === 'scrollY' || name === 'scrollYShift') {
        const el = document.querySelector('.grid-body-shared-vertical-scroll-shell') as HTMLElement;
        if (!el)
            throw Error('missing vertical owner');
        el.scrollTop = name === 'scrollY' ? 32 * (i % 30 + 2) : 480 * (i % 8 + 1);
        el.dispatchEvent(new Event('scroll'));
        return;
    }
    if (name === 'scrollX' || name === 'scrollXShift') {
        const el = document.querySelector('.grid-body-center-horizontal-scrollport--scroll-owner') as HTMLElement;
        el.scrollLeft = 125 * (name === 'scrollX' ? i % 8 + 1 : i % 8 + 10);
        if (el.scrollLeft === 0)
            throw Error('X-scroll did not move the horizontal owner');
        el.dispatchEvent(new Event('scroll'));
        return;
    }
    if (name === 'paste') {
        return new Promise<void>(resolve => { const off = a.events.on('rows:changed', () => { off(); resolve(); }); const el = cell() ?? document.querySelector('.grid-stage')!; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true })); });
    }
    if (name === 'sequential20') {
        for (let j = 0; j < 20; j++)
            await a.rows.applyEdits([{ rowId: `r${j}`, data: { value: 1000 + i } }], { reapply: true });
        return;
    }
    if (name === 'batch20') {
        return a.rows.batchMutations(() => { for (let j = 0; j < 20; j++)
            a.rows.applyEdits([{ rowId: `r${j}`, data: { value: 1000 + i } }], { reapply: true }); });
    }
    if (name === 'capture')
        return a.read.captureView({ include: ['rows', 'columns', 'computed'] });
    if (name === 'exportPrepare') {
        const sentinel = {};
        try {
            await exportDataGridXlsx(a, { formulas: 'values', onProgress: p => { if (p.phase === 'preparing')
                    throw sentinel; } });
        }
        catch (e) {
            if (e !== sentinel)
                throw e;
        }
        return;
    }
    throw Error(`unknown action ${name}`);
}
async function measure(name: string, counted = false, settleIdle = false) {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = async () => {
            channel.port1.close();
            channel.port2.close();
            try {
                if (counted) observeKinds();
                clear();
                const old = new Set(document.querySelectorAll('.grid-cell'));
                if (counted) active = true;
                const start = performance.now();
                const pending = action(name);
                const called = performance.now();
                await pending;
                const settled = performance.now();
                await nextTick();
                const flushed = performance.now();
                await stable();
                let idleFrames = 0;
                if (settleIdle) {
                    while (document.querySelector('.grid-stage--scrolling') && idleFrames < 90) {
                        await new Promise<void>(done => requestAnimationFrame(() => done()));
                        await nextTick();
                        idleFrames++;
                    }
                    if (idleFrames === 90) throw Error('scroll idle did not settle');
                    await stable();
                }
                const painted = performance.now();
                active = false;
                const now = [...document.querySelectorAll('.grid-cell')];
                resolve({
                    callMs: called-start, settledMs: settled-start,
                    vueFlushMs: flushed-start, twoFrameMs: painted-start,
                    idleFrames,
                    ...(counted ? {
                        work, retainedCellNodes: now.filter(node => old.has(node)).length,
                        mountedCellNodes: now.length,
                        scrollY: (document.querySelector('.grid-body-shared-vertical-scroll-shell') as HTMLElement)?.scrollTop,
                        scrollX: (document.querySelector('.grid-body-center-horizontal-scrollport--scroll-owner') as HTMLElement)?.scrollLeft,
                        perf: (window as any).__AFFINO_DATAGRID_PERF__?.samples ?? []
                    } : {})
                });
            } catch (error) {
                active = false;
                reject(error);
            }
        };
        channel.port2.postMessage(0);
    });
}

;
(window as any).cost = { mount, measure, prepare, stable, api, raw: () => raw, close: () => { active = false; app?.unmount(); raw?.dispose(); for (const r of restores)
        r(); } };
(window as any).cost.ready = true;
