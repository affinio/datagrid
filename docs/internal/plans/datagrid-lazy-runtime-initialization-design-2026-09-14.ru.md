# Design proposal: lazy runtime initialization for DataGrid

Статус: proposed, runtime implementation не начата.

Цель — уменьшить parse/evaluate/startup и retained allocations для plain-grid consumers, сохранив текущие public entrypoints и eager behavior там, где capability действительно используется. Package dist size сам по себе не является достаточным доказательством проблемы.

## Measurement boundary

Нужны production-shaped consumer fixtures, собранные одинаковым toolchain:

- plain fixed-row grid без formula, pivot, grouping, server datasource и worker;
- sorted/filter client grid;
- advanced grid с formula/group/pivot;
- Vue app cold mount и create/dispose cycle.

Для каждого fixture фиксируются raw/tree-shaken/gzip/Brotli bytes, parse/evaluate time, factory-to-ready, first correct paint, peak/retained heap и create/dispose count. Import-only numbers из package footprint baseline остаются отдельным измерением.

## Ownership and loading

- Public `@affino/datagrid-core` и `@affino/datagrid-vue` entrypoints сохраняют текущий export contract.
- Existing factory composition остаётся владельцем runtime; lazy capability creation добавляется внутрь него, без нового global manager.
- Base row model создаёт только обязательные state, row identity, basic projection и viewport dependencies.
- Formula, aggregation, pivot, grouping, server cache и worker bridges создаются при первом требующем их option/operation; capability activation становится monotonic до dispose.
- Dynamic import не вводится в synchronous core factory без отдельного async API proposal: synchronous creation semantics и SSR должны сохраниться.

## Invariants

- Plain mode не меняет snapshots, row identity, ordering, patch semantics и disposal behavior.
- Activation после initial rows не теряет revision, pending updates, viewport range или history state.
- Unsupported capability fails at the same public boundary and with compatible diagnostics.
- No capability is initialized merely because its module is re-exported from an entrypoint.
- Repeated reads and create/dispose cycles are idempotent; no retained listeners, caches or worker handles.

## Rollout

1. Выполнено: `bench:datagrid:runtime-lifecycle` добавляет production-shaped plain/sorted-filtered/advanced factory-to-ready и create/dispose measurement; baseline хранится в `docs/perf/datagrid-runtime-lifecycle-baseline.json`. Import-only numbers из package footprint остаются отдельным измерением.
2. Выполнено для column histogram, pivot projection, aggregation engine, tree projection и formula diagnostics: capability создаются через internal lazy slots при первом требующем вызове, parity покрыта focused tests; formula/tree/aggregation остаются следующими кандидатами после runtime measurements.
3. Compare plain and advanced fixtures with a fixed budget; reject if cold ready/first paint or memory regresses.
4. Repeat for remaining capabilities only where consumer fixture proves a material cost.
5. Update public docs only after tree-shaken and runtime evidence demonstrates a stable benefit.

Новые async factories, capability registration hooks или entrypoints требуют отдельного public API proposal и согласования.
