/** Cache work controls; emitted Core, no source aliases. */
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { createAdvancedClientRowModel } = await import(pathToFileURL(resolve('packages/datagrid-core/dist/src/models/clientRowModel.js')));
const out = resolve(process.env.COST_OUTPUT ?? '/tmp/affino-cost-audit');
mkdirSync(out, { recursive: true });
const results = [];
for (const n of [1000, 5000, 20000]) {
    const model = createAdvancedClientRowModel({ rows: Array.from({ length: n }, (_, id) => ({ id, value: id % 100, spare: 0 })), resolveRowId: r => r.id });
    const before = model.getDerivedCacheDiagnostics();
    const t = performance.now();
    model.setSortModel([{ key: 'value', direction: 'asc' }]);
    const coldMs = performance.now() - t, after = model.getDerivedCacheDiagnostics();
    for (const mode of ['directionChange', 'stableReapply', 'unrelatedEdit']) {
        const times = [], deltas = [];
        for (let i = 0; i < 35; i++) {
            const b = model.getDerivedCacheDiagnostics(), rev = model.getSnapshot().projection.recomputeVersion;
            const t = performance.now();
            if (mode === 'directionChange')
                model.setSortModel([{ key: 'value', direction: i % 2 ? 'asc' : 'desc' }]);
            if (mode === 'stableReapply')
                model.refresh('reapply');
            if (mode === 'unrelatedEdit')
                model.patchRows([{ rowId: 0, data: { spare: i + 1 } }], { recomputeSort: true, recomputeFilter: true, recomputeGroup: true });
            const elapsed = performance.now() - t, a = model.getDerivedCacheDiagnostics();
            if (i >= 5) {
                times.push(elapsed);
                deltas.push({ sortHits: a.sortValueHits - b.sortValueHits, sortMisses: a.sortValueMisses - b.sortValueMisses, cycles: model.getSnapshot().projection.recomputeVersion - rev });
            }
        }
        const sorted = [...times].sort((a, b) => a - b);
        results.push({ n, mode, samples: 30, medianMs: sorted[14], p95Ms: sorted[28], deltas });
    }
    results.push({ n, mode: 'firstColdSort', samples: 1, elapsedMs: coldMs, sortHits: after.sortValueHits - before.sortValueHits, sortMisses: after.sortValueMisses - before.sortValueMisses });
    model.dispose();
}
writeFileSync(resolve(out, 'cache-cost.json'), JSON.stringify(results, null, 2));
