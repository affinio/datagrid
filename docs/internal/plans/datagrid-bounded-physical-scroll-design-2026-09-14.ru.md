# Design proposal: bounded physical scroll mapping

Статус: proposed, runtime implementation не начата.

Цель — поддержать logical row counts, чья estimated/variable content height превышает browser DOM scroll extent, сохранив один logical coordinate contract для viewport consumers.

## Coordinate domains

Viewport engine владеет двумя явно различными доменами:

- `logical`: row offsets, row index lookup, selection anchors, restore и `scrollToCell`;
- `physical`: native element `scrollTop`/`scrollHeight`, pointer/wheel input и DOM writes.

При `logicalScrollableExtent <= measuredPhysicalExtent` mapping identity. Иначе engine вычисляет monotonic scale по usable ranges (`logicalMax / physicalMax`) и переводит physical input в logical offset перед range math; результат virtualizer переводится обратно в physical перед DOM write. Mapping revision меняется при resize, row-height revision, total count и native extent changes.

Нельзя использовать scale для row identity: row index inverse lookup всегда выполняется в logical domain. Fractional offsets сохраняются до boundary clamp, чтобы не накапливать rounding drift.

## Ownership

Core viewport math владеет pure mapping/clamp helpers и публикует internal snapshot с logical/physical extents, scale и revision. Vue app владеет DOM sampling, ResizeObserver, rAF scheduling и применением physical scroll. Existing public position APIs остаются logical; новые coordinate fields не добавляются.

Все входы/выходы должны проходить mapping boundary:

- native scroll, wheel/touch and thumb movement;
- `scrollToCell`, keyboard End and viewport restore;
- selection/fill geometry, overlays and pinned-row synchronization;
- saved position snapshots and server viewport requests.

## Variable heights and guards

Variable-height metrics provide logical offsets and inverse lookup. Mapping uses the current logical total height; if native extent is unavailable, engine сохраняет identity и ждёт measurement. Zero/invalid extents fail closed to top and never produce NaN. A mapping change preserves the logical anchor row when possible, then clamps to new physical range.

## Required acceptance matrix

- 1M and 10M logical rows at 24/31/100 px;
- variable heights with overrides near top, middle and last row;
- top/middle/last reachability, thumb drag, keyboard End and programmatic scroll;
- resize, fractional zoom, repeated mapping revisions and reverse scroll;
- selection/fill, overlays, pinned top/bottom and restore anchor continuity;
- no blank viewport, no logical index drift, bounded DOM extent and retained heap;
- real Chromium profiles with the browser-reported native maximum, plus a lower synthetic limit contract.

Implementation must land in separate core math and Vue integration slices, each with differential oracle tests and browser evidence. Do not infer a universal browser maximum from one environment.
