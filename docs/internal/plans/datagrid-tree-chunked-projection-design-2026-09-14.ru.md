# Design proposal: chunked tree projection and group index

Статус: POC выполнен; production sequence integration и differential validation остаются открытыми.

Цель — уменьшить стоимость локального tree expand/collapse, когда замена одного subtree сдвигает большой flattened projection и индекс групп. Текущий bounded manual shift устраняет spread/temporary arrays, но сохраняет O(P) копирование projection и глобальный suffix index maintenance.

## Ownership

- `treeProjectionRuntime` сохраняет ownership tree cache, expansion semantics и projection result.
- Новая внутренняя sequence representation должна быть скрыта за текущим `TreeProjectionResult.rows` compatibility boundary; public row model snapshots остаются обычными ordered rows.
- Group lookup не должен зависеть от сканирования всего flattened array.

## Candidate structure

- Ordered projection хранится как chunked sequence с bounded target chunk size и stable row identity.
- Expand/collapse заменяет только затронутые chunks; соседние chunks split/merge по deterministic thresholds.
- Group index хранит row identity → logical position через sequence locator, а не абсолютный индекс, который нужно переписывать после каждого shift.
- Materializing `rows` для existing consumers выполняется на границе result; viewport/range consumers должны иметь bounded range read до изменения этой boundary.

## Invariants

- Row order, group row identity, display index, expansion state, aggregates и collapse/reopen semantics совпадают с текущим array oracle.
- Filter/sort/group/tree/pivot cache revisions и stale projection behavior не меняются.
- `getRow`, `getRowsInRange`, viewport ranges и pagination сохраняют текущие inclusive boundaries.
- No mutable chunk is exposed through public snapshots; dispose releases all chunks and indexes.
- Wide branch replacement никогда не передаёт descendants через variadic `splice`/`push` arguments.

## Required validation

- path и parent trees: 20k/150k/300k leaves, shallow wide, deep skewed и branch near start/middle/end;
- expand/collapse latency, allocations и peak heap against current manual-shift oracle;
- repeated sibling toggles, filtered tree, sorted tree, aggregates и patch-by-identity;
- random operation differential test comparing ordered rows and group index lookup;
- viewport range reads, snapshot/export compatibility, dispose and cache invalidation.

Internal sequence proof-of-concept выполнен в `models/tree/treeProjectionChunkedSequence.ts`; contract и 300k local replacement benchmark показывают material win для локальной замены. Production tree runtime пока сохраняет array path как differential oracle. Не менять public tree API или default representation до differential subtree validation, heap measurements и range-read acceptance.
