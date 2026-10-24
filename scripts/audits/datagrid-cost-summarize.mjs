/** Summarize raw audit profiles; does not infer total allocations from heap/RSS deltas. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), out = resolve(process.env.COST_OUTPUT ?? '/tmp/affino-cost-audit');
const read = p => JSON.parse(readFileSync(resolve(out, p), 'utf8'));
const traceFolder = readdirSync(resolve('node_modules/.pnpm')).find(n => n.startsWith('@jridgewell+trace-mapping@'));
const { TraceMap, originalPositionFor } = require(resolve('node_modules/.pnpm', traceFolder, 'node_modules/@jridgewell/trace-mapping/dist/trace-mapping.umd.js'));
const maps = new Map();
function original(frame) {
    const path = resolve(out, 'source-maps', basename(frame.url ?? '') + '.map');
    if (!existsSync(path))
        return { source: frame.url ?? '', line: (frame.lineNumber ?? -1) + 1, name: frame.functionName || '(anonymous)' };
    if (!maps.has(path))
        maps.set(path, new TraceMap(JSON.parse(readFileSync(path, 'utf8'))));
    const mapped = originalPositionFor(maps.get(path), { line: frame.lineNumber + 1, column: frame.columnNumber });
    return { source: mapped.source ?? frame.url, line: mapped.line, name: mapped.name ?? (frame.functionName || '(anonymous)') };
}
const profiles = {};
for (const file of readdirSync(out).filter(f => f.endsWith('.cpuprofile'))) {
    const p = read(file), nodes = new Map(p.nodes.map(n => [n.id, n])), buckets = new Map();
    for (let i = 0; i < (p.samples?.length ?? 0); i++) {
        const node = nodes.get(p.samples[i]);
        if (!node)
            continue;
        const f = original(node.callFrame);
        const key = JSON.stringify(f);
        const b = buckets.get(key) ?? { ...f, selfSamples: 0, estimatedMs: 0 };
        b.selfSamples++;
        b.estimatedMs += (p.timeDeltas?.[i] ?? 0) / 1000;
        buckets.set(key, b);
    }
    profiles[file] = { sampleCount: p.samples?.length ?? 0, top: [...buckets.values()].sort((a, b) => b.estimatedMs - a.estimatedMs).filter(r => r.source).slice(0, 12) };
}
const allocations = {};
for (const file of readdirSync(out).filter(f => f.endsWith('.heapprofile'))) {
    const p = read(file), buckets = new Map();
    function walk(n) { const key = (n.callFrame.functionName || '(anonymous)') + ' ' + n.callFrame.url; const value = buckets.get(key) ?? { name: n.callFrame.functionName || '(anonymous)', source: n.callFrame.url, sampledEstimatedBytes: 0 }; value.sampledEstimatedBytes += n.selfSize ?? 0; buckets.set(key, value); for (const child of n.children ?? [])
        walk(child); }
    walk(p.head);
    allocations[file] = { operations: 80, sampledEstimatedBytes: [...buckets.values()].reduce((s, v) => s + v.sampledEstimatedBytes, 0), top: [...buckets.values()].sort((a, b) => b.sampledEstimatedBytes - a.sampledEstimatedBytes).slice(0, 8) };
}
const core = read('core-cost.json'), browser = read('browser-cost.json');
const synchronousLayouts = [];
for (const file of readdirSync(out).filter(name => name.endsWith('.trace.json'))) {
    const events = read(file).traceEvents;
    const javascript = events.filter(event => event.ph === 'X' && ['FunctionCall', 'RunMicrotasks', 'V8.Execute'].includes(event.name));
    const layouts = events.filter(event => event.ph === 'X' && event.name === 'Layout' && javascript.some(parent => parent.pid === event.pid && parent.tid === event.tid && parent.ts <= event.ts && parent.ts + parent.dur >= event.ts + event.dur));
    synchronousLayouts.push({ file, count: layouts.length, totalMs: layouts.reduce((sum, event) => sum + event.dur / 1000, 0), stacks: layouts.flatMap(event => event.args?.beginData?.stackTrace ?? []).slice(0, 8).map(frame => original({ ...frame, lineNumber: frame.lineNumber - 1, columnNumber: frame.columnNumber - 1 })) });
}
const result = { commit: readFileSync(resolve(out, 'commit.txt'), 'utf8').trim(), node: core.node, browser: browser.browser, core: [...core.results, ...(existsSync(resolve(out, 'controls/core-cost.json')) ? read('controls/core-cost.json').results : []), ...(existsSync(resolve(out, 'summary-control/core-cost.json')) ? read('summary-control/core-cost.json').results : [])], cold: core.cold, caches: read('cache-cost.json'), browserResults: browser.results.map(r => ({ n: r.n, c: r.c, action: r.action, samples: r.samples.length, summary: r.summary, cdpSummary: r.cdpSummary, counted: { ...r.counted, perf: undefined }, perfSummary: r.counted.perf?.map(p => ({ scope: p.scope, totalMs: p.totalMs, renderedRows: p.renderedRows, renderedColumns: p.renderedColumns, blankViewport: p.blankViewport, visibleRowsMode: p.visibleRowsMode, rangeResolveMs: p.rangeResolveMs })) })), profiles, allocations, traces: read('browser-trace-summary.json'), errors: browser.errors };
result.synchronousLayouts = synchronousLayouts;
result.scrollIdle = existsSync(resolve(out, 'browser-scroll-idle.json')) ? read('browser-scroll-idle.json').map(({ samples, counted, ...rest }) => ({ ...rest, samples: samples.length, counted: { ...counted, perf: undefined } })) : [];
for (const entry of result.browserResults) {
    entry.rowReadCallers = (entry.counted.work.readCallerSamples ?? []).slice(0, 2).map(stack => [...stack.matchAll(/(http[^ )]+\.js):(\d+):(\d+)/g)].map(match => original({ url: match[1], lineNumber: Number(match[2])-1, columnNumber: Number(match[3])-1 })));
}

result.exportLocaleControls = existsSync(resolve(out, 'browser-locale-control.json')) ? read('browser-locale-control.json') : [];
result.headAtCompletion = existsSync(resolve(out, 'final-head.txt')) ? readFileSync(resolve(out, 'final-head.txt'), 'utf8').trim() : result.commit;
result.sourceFingerprint = existsSync(resolve(out, 'product-source-manifest.json')) ? read('product-source-manifest.json').fingerprint : null;
writeFileSync(resolve(out, 'cost-summary.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ coreScenarios: result.core.length, browserScenarios: result.browserResults.length, profiles: Object.keys(profiles).length, allocations: Object.keys(allocations).length, output: resolve(out, 'cost-summary.json') }));
