/** Separates a continuous scroll window from the documented 120ms scroll-idle phase. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(process.env.COST_OUTPUT ?? '/tmp/affino-cost-audit');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }), page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(process.env.COST_BASE_URL ?? 'http://127.0.0.1:4190/');
await page.waitForFunction(() => window.cost?.ready);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
const results = [];
for (const [n, c, action] of [[1000, 12, 'scrollYShift'], [5000, 12, 'scrollYShift'], [20000, 12, 'scrollYShift'], [1000, 64, 'scrollXShift'], [1000, 256, 'scrollXShift']]) {
    await page.evaluate(({ n, c }) => window.cost.mount(n, c, false), { n, c });
    const samples = [];
    for (let i = 0; i < 35; i++) {
        const before = await metrics();
        const value = await page.evaluate(action => window.cost.measure(action, false, true), action);
        const after = await metrics();
        if (i >= 5)
            samples.push({ elapsedUntilIdleMs: value.twoFrameMs, taskMs: 1000 * (after.TaskDuration - before.TaskDuration), layoutMs: 1000 * (after.LayoutDuration - before.LayoutDuration), scriptMs: 1000 * (after.ScriptDuration - before.ScriptDuration) });
    }
    await page.evaluate(({ n, c }) => window.cost.mount(n, c, true), { n, c });
    const counted = await page.evaluate(action => window.cost.measure(action, true, true), action);
    const stat = key => { const v = samples.map(s => s[key]).sort((a, b) => a - b); return { median: v[14], p95: v[28] }; };
    results.push({ n, c, action, samples, summary: { elapsedUntilIdleMs: stat('elapsedUntilIdleMs'), taskMs: stat('taskMs'), layoutMs: stat('layoutMs'), scriptMs: stat('scriptMs') }, counted });
    writeFileSync(resolve(out, 'browser-scroll-idle.json'), JSON.stringify(results, null, 2));
}
await page.evaluate(() => window.cost.close());
await browser.close();
console.log(JSON.stringify({ scenarios: results.length, samplesEach: 30 }));
