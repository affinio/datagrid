# Design proposal: deferred authored renderer policy

Статус: internal queue gate implemented; renderer wiring, opt-in policy и browser evidence остаются открытыми.

Цель — уменьшить вклад тяжёлых `cellRenderer`/`groupCellRenderer` в scroll render window, сохранив identity stateful children и текущие synchronous semantics по умолчанию.

## Policy boundary

- Existing default остаётся synchronous: renderer получает тот же context, ошибки сохраняют display-value fallback.
- Deferred rendering включается явной opt-in policy на уровне grid/app. Новый public option должен быть предложен отдельным API review до реализации.
- Policy применяется только к authored renderer content в body viewport; headers, editors, pinned row semantics и group disclosure не откладываются автоматически.
- Во время active scroll renderer slot показывает placeholder только для content, которое ещё не готово; shell, row identity, ARIA cell semantics и размеры остаются доступными.

## Scheduling contract

- Scroll lifecycle владеет одним deferred queue и budget-ом на animation frame; queue не создаёт reactive writes в native scroll handler.
- После последнего scroll event очередь получает bounded deadline через `requestAnimationFrame`; renderer content появляется за ограниченное число frames.
- Новый row/column identity отменяет старую работу до invocation; stale result не может заменить новый slot.
- Очередь ограничена по числу pending cells и имеет deterministic eviction/priority: visible center cells раньше far overscan, pinned cells имеют отдельный priority class.
- Renderer callback остаётся pure synchronous function; Promise-returning renderer и implicit cache не вводятся.

## Identity and interaction invariants

- Stateful component VNodes и interactive native children сохраняют row-keyed identity; viewport slot reuse не переносит editor/focus state между строками.
- Focused editor, selection/fill, group toggle, keyboard navigation, context menu и pointer ownership не проходят через deferred placeholder.
- Placeholder-aware authored renderer получает тот же `surface.kind` и не меняет публичное значение cell.
- После scroll-stop окончательный content обязан появиться в bounded time; renderer errors используют существующий display-value fallback и telemetry.
- Default synchronous mode и browser-visible output остаются byte/semantics-compatible до opt-in.

## Measurement and rollout

До runtime slice нужны paired browser runs для plain, formatter-only, native span, Vue component, interactive renderer и deliberately slow renderer:

- input-to-paint и frame p50/p95/p99 во время smooth, fast и jump scroll;
- aggregate renderer time per frame, callback count и queue latency;
- blank pixels, stale content и time-to-final-content после scroll-stop;
- editor focus, selection continuity, group semantics, a11y ids, pinned-pane alignment и retained heap.

Existing `dgPerfTrace=1` scopes `stageRenderWindow`, `cellRenderer`, `groupCellRenderer` и enterprise browser render profiles являются baseline instrumentation. До появления свежего Chromium artifact runtime policy нельзя считать доказанно улучшающей UX.

## Rollout gates

1. Выполнено частично: internal bounded priority queue и stale-key cancellation покрыты contract/benchmark; scheduler wiring и identity contract остаются.
2. Browser differential run with opt-in disabled: zero behavior delta.
3. Opt-in browser run: no blank viewport, no focus/selection/group/a11y regressions, bounded final-content latency.
4. Only then expose documented public option and add profile-specific budget.

Новые public options, placeholder slots или renderer context fields требуют отдельного согласования API. Реализация должна расширять существующего stage/render ownership и не создавать параллельный renderer manager.
