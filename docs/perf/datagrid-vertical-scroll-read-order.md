# Vertical scroll read ordering

Scope: `@affino/datagrid-vue`, `useDataGridStageViewportRuntime`.

The shared vertical scroll handler previously wrote the inherited pane offset
(`--datagrid-body-scroll-top`) and then read DOM scroll offsets again through
the center handler. Dimension fallbacks also ran after the style write. Such
reads can force synchronous style/layout work during a native scroll event.

The handler now samples offsets and fallback dimensions before writing the pane
offset, then forwards the captured composite viewport event. The vertical offset
is sampled once instead of twice. Pane positioning remains synchronous, and Vue
state and chrome drawing still use the existing animation-frame scheduler.

The regression test checks read/write ordering with uncached dimensions and
verifies that the adapter receives current offsets and dimensions. Existing
tests cover batching, unchanged offsets, boundary behavior, and disposal.

## Browser comparison

Baseline: `de9ac238`. Candidate: the read-order change described above.
Environment: Linux arm64 (OrbStack kernel `7.0.14-orbstack-00380-ga7e0a2dc9535`),
Node `24.21.0`, headless Chromium `145.0.7632.0`, desktop viewport 1680×1050,
Vite development server, default sandbox renderers. Two sessions per variant;
10,000 rows, 32 columns, 180 steps of 96 px with a configured 16 ms delay.

| Metric | Before | After |
| --- | ---: | ---: |
| Frame interval p50 (pooled samples) | 16.70 ms | 16.70 ms |
| Frame interval p95 (pooled samples) | 16.78 ms | 16.70 ms |
| Long tasks | 0 | 0 |
| Reported blank viewports | 0 | 0 |
| Peak stage DOM nodes | 938 | 938 |

These short, refresh-limited runs do **not** establish a perceptible FPS gain.
The verified improvement is removal of duplicate scroll reads and the
read-after-style-write ordering in the raw handler. The benchmark's blank-window
counter checks rendered row availability; the separate fast-scroll browser test
checks geometric gaps. Physical trackpad momentum, high-refresh displays, custom
cell renderers, and large auto-height workloads still need targeted profiling.

Reproduce on each revision with a free port and a fresh server:

```sh
BENCH_BROWSER_BASE_URL=http://127.0.0.1:4187 \
BENCH_BROWSER_SCENARIOS=vertical-smooth-scroll \
BENCH_BROWSER_SESSIONS=2 \
BENCH_BROWSER_ROW_COUNT=10000 \
BENCH_BROWSER_COLUMN_COUNT=32 \
BENCH_BROWSER_SMOOTH_SCROLL_STEPS=180 \
BENCH_BROWSER_ENABLE_FILTER=false \
BENCH_BROWSER_ENABLE_SORT=false \
BENCH_BROWSER_ENABLE_CELL_UPDATES=false \
BENCH_OUTPUT_JSON=/tmp/affino-vertical-scroll.json \
node scripts/bench-datagrid-enterprise-browser-frames.mjs
```
