/** Run against the production fixture built/served with datagrid-cost-browser/vite.config.mts. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(process.env.COST_OUTPUT ?? '/tmp/affino-cost-audit'), url = process.env.COST_BASE_URL ?? 'http://127.0.0.1:4190/';
const samples = Number(process.env.COST_BROWSER_SAMPLES ?? 30), warmups = 5;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.cost?.ready);
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
const quantile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * p) - 1)] ?? 0;
const stat = xs => ({ median: quantile(xs, .5), p95: xs.length >= 20 ? quantile(xs, .95) : null, min: Math.min(...xs), max: Math.max(...xs) });
async function mount(n, c, counted) { return page.evaluate(async ({ n, c, counted }) => { history.replaceState(null, '', counted ? '/?dgPerfTrace=1' : '/?dgPerfTrace=0'); const result = await window.cost.mount(n, c, counted); window.__AFFINO_DATAGRID_PERF__?.clear(); return result; }, { n, c, counted }); }
async function measure(action, counted = false) { await page.evaluate(action => window.cost.prepare(action), action); const before = await metrics(); const result = await page.evaluate(({ action, counted }) => window.cost.measure(action, counted), { action, counted }); const after = await metrics(); return { ...result, cdp: Object.fromEntries(['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration', 'LayoutCount', 'RecalcStyleCount', 'JSHeapUsedSize', 'Nodes'].map(k => [k, after[k] - before[k]])) }; }
async function trace(n, c, action) {
    await mount(n, c, false);
    const complete = new Promise(r => client.once('Tracing.tracingComplete', r));
    await client.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline.stack', transferMode: 'ReturnAsStream' });
    await client.send('Profiler.enable');
    await client.send('Profiler.start');
    for (let i = 0; i < 8; i++) {
        await page.evaluate(name => performance.mark(`cost-start-${name}`), action);
        await measure(action);
        await page.evaluate(name => performance.mark(`cost-end-${name}`), action);
    }
    const cpu = await client.send('Profiler.stop');
    await client.send('Tracing.end');
    const event = await complete;
    let content = '';
    while (true) {
        const r = await client.send('IO.read', { handle: event.stream });
        content += r.data;
        if (r.eof)
            break;
    }
    await client.send('IO.close', { handle: event.stream });
    const key = `browser-${n}x${c}-${action}`;
    writeFileSync(resolve(out, `${key}.trace.json`), content);
    writeFileSync(resolve(out, `${key}.cpuprofile`), JSON.stringify(cpu.profile));
    const events = JSON.parse(content).traceEvents;
    const summary = {};
    for (const e of events)
        if (['Layout', 'UpdateLayoutTree', 'Paint', 'PrePaint', 'RunTask', 'FunctionCall', 'MinorGC', 'MajorGC'].includes(e.name) && e.ph === 'X') {
            const v = summary[e.name] ?? { count: 0, totalMs: 0, maxMs: 0, jsStackEvents: 0 };
            v.count++;
            v.totalMs += (e.dur ?? 0) / 1000;
            v.maxMs = Math.max(v.maxMs, (e.dur ?? 0) / 1000);
            if (e.args?.beginData?.stackTrace?.length || e.args?.data?.stackTrace?.length)
                v.jsStackEvents++;
            summary[e.name] = v;
        }
    return { key, summary };
}
const only = new Set((process.env.COST_BROWSER_ACTIONS ?? '').split(',').filter(Boolean));
const results = only.size && existsSync(resolve(out, 'browser-cost.json')) ? JSON.parse(readFileSync(resolve(out, 'browser-cost.json'), 'utf8')).results.filter(r => !only.has(r.action)) : [];
for (const [n, c] of [[1000, 12], [5000, 12], [20000, 12], [1000, 64], [1000, 256]]) {
    const actions = c === 12 ? ['sort', 'filter', 'group', 'pivot', 'aggregateEdit', 'append4', 'remove4', 'edit', 'selectOne', 'selectAll', 'resize', 'reorder', 'pin', 'editor', 'scrollY', 'scrollYShift', 'scrollX', 'scrollXShift', 'paste', 'sequential20', 'batch20', 'capture', 'exportPrepare'] : ['selectOne', 'selectAll', 'resize', 'reorder', 'pin', 'editor', 'scrollX', 'scrollXShift', 'exportPrepare'];
    for (const action of actions.filter(name => !only.size || only.has(name))) {
        const fixture = await mount(n, c, false);
        if (!fixture.prod || fixture.sourceRows !== n || fixture.mountedCells < 20)
            throw Error('invalid production fixture');
        const cold = await measure(action), timings = [];
        for (let i = 1; i < warmups; i++)
            await measure(action);
        for (let i = 0; i < samples; i++)
            timings.push(await measure(action));
        await mount(n, c, true);
        const counted = await measure(action, true);
        results.push({ n, c, action, fixture, cold, samples: timings, summary: Object.fromEntries(['callMs', 'settledMs', 'vueFlushMs', 'twoFrameMs'].map(k => [k, stat(timings.map(v => v[k]))])), cdpSummary: Object.fromEntries(['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration', 'LayoutCount', 'RecalcStyleCount', 'Nodes', 'JSHeapUsedSize'].map(k => [k, stat(timings.map(v => v.cdp[k]))])), counted });
        writeFileSync(resolve(out, 'browser-cost.json'), JSON.stringify({ browser: browser.version(), samples, warmups, viewport: { width: 1200, height: 800 }, production: true, results, errors }, null, 2));
    }
}
const tracePath = resolve(out, 'browser-trace-summary.json');
const traces = only.size && existsSync(tracePath) ? JSON.parse(readFileSync(tracePath, 'utf8')).filter(r => ![...only].some(action => r.key.endsWith('-' + action))) : [];
for (const [n, c, action] of [[20000, 12, 'edit'], [20000, 12, 'selectAll'], [20000, 12, 'scrollY'], [20000, 12, 'scrollYShift'], [20000, 12, 'pin'], [20000, 12, 'exportPrepare'], [1000, 256, 'scrollX'], [1000, 256, 'scrollXShift'], [1000, 256, 'reorder']])
    if (!only.size || only.has(action))
        traces.push(await trace(n, c, action));
writeFileSync(resolve(out, 'browser-trace-summary.json'), JSON.stringify(traces, null, 2));
const localeControls = [];
for (const [n, c] of [[1000, 12], [20000, 12], [1000, 256]]) {
    await mount(n, c, true);
    const result = await page.evaluate(async () => { let calls = 0; const original = String.prototype.toLocaleLowerCase; String.prototype.toLocaleLowerCase = function (...args) { calls++; return Reflect.apply(original, this, args); }; try {
        const result = await window.cost.measure('exportPrepare', true);
        return { calls, exportCells: result.work.exportCells };
    }
    finally {
        String.prototype.toLocaleLowerCase = original;
    } });
    localeControls.push({ n, c, ...result });
}
writeFileSync(resolve(out, 'browser-locale-control.json'), JSON.stringify(localeControls, null, 2));
await page.evaluate(() => window.cost.close());
await browser.close();
console.log(JSON.stringify({ scenarios: results.length, samples, errors, output: out }));
