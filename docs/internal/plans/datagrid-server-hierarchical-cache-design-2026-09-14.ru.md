# Design proposal: hierarchical server datasource cache

Статус: internal store lifecycle prototype и row-model context wiring реализованы; payload-level budgets и protocol boundary остаются открытыми.

Цель — дать server-backed row model отдельные cache stores для root и каждой раскрытой group branch, сохранив текущий flat datasource protocol и bounded viewport semantics. Это решение не меняет public API до отдельного согласования.

## Store identity

Каждый store получает стабильный ключ из datasource revision, parent store key и normalized group path. Root использует фиксированный ключ `root`; branch key не зависит от текущего viewport range. Один и тот же group path при повторном раскрытии переиспользует store только при совпадающей datasource revision и query context (sort/filter/pivot/group model signature).

Store владеет:

- range cache и loading tokens только своего logical index space;
- loaded row identity и локальными intervals;
- revision/query signature, last access и lifecycle (`active`, `retained`, `disposed`);
- budget accounting по chunks, rows и estimated payload bytes.

## Ownership and consistency

Root model владеет registry stores и общей revision. Store не изменяет соседний store напрямую. Invalidation по revision сначала помечает store stale, отменяет его loads и удаляет его loaded ranges; late replies принимаются только при совпадении store generation, revision и request token.

Collapse переводит branch store в `retained` или `disposed` согласно policy. Retained store не участвует в visible viewport protection, а его budget учитывается в общей cache cap. Reopen может переиспользовать retained store при совпадении signature; иначе создаётся новый generation.

## Eviction and viewport protection

Сначала защищаются active root/branch stores, затем их текущие viewport и critical prefetch ranges. При переполнении удаляются oldest non-loading chunks внутри least-recently-used eligible store; loading chunks не удаляются. Если все candidates защищены или загружены, cache сохраняет overflow до следующего eligible transition и публикует diagnostics вместо удаления protected data.

Общая cap должна быть проверяема одновременно по `maxStores`, `maxChunks`, `maxRows` и `maxBytes`. Текущий row-model slice уже ограничивает retained contexts (`8`) и общий retained row count настроенным `rowCacheLimit`; chunk/bytes accounting остаётся следующим этапом. Default policy сохраняет текущую flat cache behavior до включения hierarchical mode.

## Required validation before implementation

- root + two sibling branches: independent loads, eviction and reopen reuse;
- nested branch collapse/reopen with out-of-order replies and revision change;
- active viewport larger than local and global limits, overscan and reverse scroll;
- no loading chunk eviction, no blank viewport, bounded retained heap;
- tree selection/restore and pivot context preserve store signature;
- controlled RTT 20/100/300 ms with request count, bytes, stale drops and cache hit ratio.

В текущих sub-slices добавлены internal `DataSourceCacheStoreRegistry` и wiring в `dataSourceBackedRowModel`: registry фиксирует store key/parent/signature, generation-safe invalidate, retained reuse и LRU eviction по `maxStores`; row model выбирает bounded cache manager/range cache для root и grouped tree contexts, а при смене context переносит только stale retained rows. Implementation всё ещё должна расширить ownership до общих row/chunk/bytes budgets. A new public protocol field or consumer-visible store API requires a separate API proposal and approval.
