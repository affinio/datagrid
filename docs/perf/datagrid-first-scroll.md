# First-scroll render invalidation

Date: 2026-10-21. Scope: `@affino/datagrid-vue` table stage.

The start of scrolling previously updated the stage's reactive root class, which
could rerender unchanged body cells before the virtual window moved. Synchronous
custom renderers also subscribed to the deferred-renderer queue revision even
when deferred rendering was disabled. Hover checks read the scroll suppression
state even when no row was hovered.

The existing stage viewport DOM adapter now owns `grid-stage--scrolling`. It
updates that class at scroll start/idle, restores it after unrelated Vue root
class patches, and removes it during teardown. Reactive interaction state stays
available for touch handles, editing guards and idle focus restoration. Default
and synchronous renderer resolution skip deferred queue dependencies; hover
checks read suppression only for the hovered row.

## Diagnostic comparison

Chromium, production sandbox, 1440 × 1000 viewport, 4× CPU throttling, three fresh
pages per route, default route datasets. A one-pixel vertical scroll isolates
scroll-state work without moving the virtual row window. Sampling includes the
following idle transition.

| Route | Renderer calls before | Renderer calls after | Virtual window changes |
| --- | ---: | ---: | ---: |
| `/vue/shell/grouped-grid` | 56 in each run | 19 in each run | 0 |

Maximum sampled frame gaps varied across repeats (roughly 16.7–33.4 ms in
isolated runs). The stable result is fewer renderer invocations; these short
diagnostic runs do not establish a general FPS improvement or prove that every
intermittent cold-scroll pause is eliminated.
Sticky row placement, hover removal, newly exposed rows, layout, JIT compilation
and pending initialization can still require work on an initial scroll.

## Reproduce

Build and serve the sandbox on port 4173, then run:

```sh
node scripts/bench-datagrid-first-scroll.mjs
```

Set `DATAGRID_BENCH_URL` to use another local server. This is a diagnostic probe,
not a hardware-sensitive timing gate. It requires Chromium installed through
Playwright. It also exercises `/vue/base-grid?rows=10000&cols=128` as a larger
control scenario and rejects non-scrollable tables. For realistic gesture checks, also test wheel input, native touch
panning, pinned/header synchronization and scroll-time editing suppression.

Focused coverage lives in `DataGridTableStage.contract.spec.ts`,
`useDataGridStageViewportRuntime.spec.ts` and
`useDataGridStageCellRendering.spec.ts` under the Vue package app layer.
