# DOM adapter horizontal scrolling

The header/body wheel path is synchronized through the same orchestration
managed-wheel helper used by Vue. The remaining measured bottleneck was
viewport materialization in `packages/datagrid-dom/src/rendering/renderGrid.ts`.

## Confirmed cost and change

Core's imperative column notification includes scroll position. The DOM adapter
previously rebuilt a detached header/body tree and recursively reconciled every
visible cell for these notifications, even when the materialized window was
unchanged. This repeatedly resolved values and allocated temporary elements.
`reconcileElement` dominated the sampled JavaScript CPU time.

The adapter now compares the DOM-relevant column window before scheduling a
render. A changed viewport window reuses mounted rows by projected index/rowId
and their cells by column index. It retains spacer elements and resolves values
only for entering cells. Retained cells stay attached, preserving editor focus.
Data, column metadata and selection invalidations still refresh cell content;
no canonical state moved from core into the renderer. Core's notification
semantics and overscan policy are unchanged.

## Reproduce

Start the standalone DOM sandbox, then run from the repository root:

```sh
DATAGRID_DOM_SANDBOX_URL=http://localhost:5175 node packages/datagrid-dom-sandbox/scripts/profile-horizontal-scroll.mjs
DATAGRID_DOM_SANDBOX_URL=http://localhost:5175 node packages/datagrid-dom-sandbox/scripts/check-scroll-sync.mjs
```

The profiler uses headless Chromium, a 1440×1000 viewport, the 80-row/120-column
column-virtualization example and 45 horizontal wheel gestures of 40px. It counts
`document.createElement` calls after startup and samples CPU and frame intervals.
It reports measurements without a hardware-dependent pass/fail timing threshold.

Representative before/after runs in the same development environment:

| Metric | Before | After |
| --- | ---: | ---: |
| Created elements during scrolling | 29,368 | 1,053 |
| JavaScript duration | 246 ms | 57 ms |
| Layout duration | 46 ms | 41 ms |
| Style recalculation duration | 35 ms | 38 ms |
| Live grid elements at end | 1,460 | 1,460 |
| p95 frame interval | 16.7 ms | 16.8 ms |

These are individual instrumented dev-server runs, not a stable FPS or latency
guarantee. The result supports reduced JavaScript/allocation work; it does not
demonstrate an improvement in layout or p95 frame time. Both runs retained an
isolated frame interval around 67ms; the sampling window includes CPU-profiler
startup. A separate frame-only run after the change, without CPU profiling,
observed a maximum interval of 16.8ms and no intervals above 25ms. This does not
establish the cause of every long frame. Precision-trackpad and real-device
checks remain necessary.

## Regression checks

- Renderer contracts preserve cell/header identity, pinned cells and editor
  focus; unchanged retained cells do not resolve their values again.
- Full data updates refresh values; a different rowId at the same projected
  position does not reuse the previous row's cells.
- Sandbox contracts cover column width/schema changes, bounded live DOM and
  combined row/column virtualization.
- The Chromium scroll check verifies wheel-task/animation-frame synchronization
  and matching header/body cell geometry at horizontal boundaries.

## Remaining visual shimmer

A browser view at an intermediate horizontal offset showed the cell grid still
looked heavier than necessary. Each neighboring cell drew a full border on its
shared edge, so internal grid lines were painted twice. At fractional scroll
offsets this creates denser, higher-contrast edges that can read as shimmer even
when header/body coordinates stay aligned. The cell stylesheet now paints each
shared inline edge once and each row edge once, without changing track sizes or
selection overlays. This is a visual rasterization improvement; no FPS gain is
claimed. Verify at fractional trackpad offsets and on high-DPI displays.

## Canvas chrome scroll regression

The DOM adapter's Canvas grid lines are owned by a persistent body anchor. A
full row render previously reconciled the next body tree by child position
without accounting for that adapter-owned node. It could turn the anchor into
the first row and detach its canvas while the `canvas-chrome-active` class kept
cell borders transparent. The render path now retains the live anchor for both
viewport-window updates and full body reconciliation. Canvas sync also avoids
reading computed styles on each render; theme values are read on attach and
resize.

The header checkbox previously expanded select-all into every projected row ID,
then recalculated `isSelected` once per row while deriving its checked state.
It now uses Core's scoped `mode: "all"` snapshot and derives the header count
from the cached projection ID set and the selected/excluded IDs.

Focused regressions cover Canvas anchor retention across row-window scrolling
and a full row update, plus the all-selection snapshot and bounded row-selection
checks. One headless Chromium run at 1440×1000 sent eight 120px vertical wheel
gestures: the viewport advanced 960px, kept 21 logical rows mounted, and kept
the canvas connected and active. A separate select-all event dispatch took
10.1ms with the example's 2,000 rows. These are single environment-specific
samples, not a
performance guarantee or a directly comparable baseline for the reported
277ms handler.
