# Design proposal: sparse pivot output storage

Статус: proposed, runtime implementation не начата.

Цель — убрать обязательную запись `null` для каждой комбинации output row × pivot column × value, сохранив существующие row model, read, export, sort и drilldown semantics.

## Storage contract

Pivot projection хранит immutable output metadata отдельно от cell values:

- ordered pivot column keys и их descriptors;
- ordered output row identities и source/group mapping;
- sparse map `rowKey → columnKey → value` только для materialized non-empty cells;
- explicit value-state для `missing`, `null` и вычисленного значения, чтобы sparse absence не менял текущую null semantics;
- revision и diagnostics cardinality.

`getCell(rowKey, columnKey, valueKey)` остаётся internal accessor. Он возвращает typed cell state и не материализует соседние cells. Existing dense row adapter может построить compatibility snapshot только для bounded export/read requests.

## Materialization boundaries

Обычный viewport read получает только запрошенные visible cells. Export выбирает explicit mode: streaming sparse records либо bounded dense chunks; unbounded dense export должен завершаться typed limit diagnostic. Drilldown и formula reads используют accessor, а не прямой доступ к dense row object. Sort/filter/group stages работают по aggregate/value accessor и не зависят от отсутствующих properties.

## Correctness invariants

- missing cell и explicit null дают одинаковый public read result;
- column and row order stable across sparse/dense adapters;
- pivot revision invalidates cell maps atomically;
- max output cell guard срабатывает до любой dense compatibility materialization;
- stale projection не заменяет последний корректный snapshot;
- custom renderer, clipboard and export receive the same value semantics;
- memory accounting включает map overhead and estimated payload bytes.

## Required validation before implementation

- 10k source rows with low and high pivot cardinality: dense oracle vs sparse accessor;
- missing/null/value reads, formula and aggregation consumers;
- viewport reads, export bounded chunks and drilldown;
- sort/filter/reapply and revision invalidation;
- heap peak and output cardinality at 50k source rows, with 1/3/10 value specs;
- browser pinned-pane rendering and custom renderer compatibility.

Implementation must extend the existing pivot projection ownership. New public sparse accessor or export mode requires a separate API proposal and approval.
