# DataGrid Scripts Cheatsheet (RU/EN)

Короткая шпаргалка по скриптам из `/Users/anton/Projects/affinio/datagrid/package.json` и ключевым standalone-скриптам из `/Users/anton/Projects/affinio/datagrid/scripts`.

## Быстрые правила / Quick rules

- RU: Для `bench:*:assert` главный индикатор — `ok: true` и пустой `budgetErrors` в JSON-отчете.
- EN: For `bench:*:assert`, the primary signal is `ok: true` and empty `budgetErrors` in the JSON report.
- RU: Почти везде смотрим `p95/p99`, `cvPct` (variance), `heapDeltaMb`/рост памяти.
- EN: In most benches, watch `p95/p99`, `cvPct` (variance), and `heapDeltaMb`/memory growth.
- RU: Артефакты обычно пишутся в `artifacts/performance/*.json`.
- EN: Artifacts are usually written to `artifacts/performance/*.json`.

## 1) Root workflow scripts

| Script | RU: что делает / что смотрим | EN: what it does / what to watch |
|---|---|---|
| `check` | Запускает `type-check` + unit для datagrid. Смотрим, что пайплайн базовой валидации зеленый. | Runs `type-check` + datagrid unit. Watch for a clean baseline gate. |
| `lint` | Сейчас эквивалент `type-check`. | Currently equivalent to `type-check`. |
| `build` | Рекурсивная сборка всех пакетов. Смотрим, что нет build-break по монорепе. | Recursive build for all packages. Watch for cross-package build breaks. |
| `type-check` | Рекурсивный TS-check всех пакетов. | Recursive TS check across packages. |
| `test` | Рекурсивный запуск тестов во всех пакетах. | Recursive test run for all packages. |
| `test:unit` | Технически тот же recursive test-run. | Technically same recursive test run. |
| `bench:regression` | Агрегированный perf-gate через CI harness. | Aggregated perf gate via CI harness. |

## 2) Sandbox scripts

| Script | RU | EN |
|---|---|---|
| `sandbox:dev` | Поднимает datagrid sandbox для ручной проверки UI/маршрутов/интеракций. | Starts datagrid sandbox for manual UI/route/interaction validation. |
| `sandbox:build` | Сборка sandbox (проверка production-совместимости). | Builds sandbox (production-compat check). |
| `test:e2e:sandbox` | Полный Playwright e2e по sandbox. Смотрим стабильность сценариев. | Full Playwright e2e for sandbox. Watch scenario stability. |
| `test:e2e:sandbox:headed` | То же, но в headed-режиме для отладки. | Same, but headed mode for debugging. |

## 3) Test scripts (datagrid scope)

| Script | RU | EN |
|---|---|---|
| `test:datagrid:unit` | Unit-тесты core/worker/vue/orchestration. | Unit tests for core/worker/vue/orchestration. |
| `test:datagrid:integration` | Интеграционные тесты core + vue. | Integration tests for core + vue. |
| `test:datagrid:contracts` | Контрактные тесты API/поведения. | Contract tests for API/behavior guarantees. |
| `test:datagrid:regressions` | Регрессионные кейсы в core. | Core regression suite. |
| `test:datagrid:strict-contracts` | Строгие контракты/инварианты API. | Strict API contracts/invariants. |
| `test:datagrid:coverage` | Прогон тестов с покрытием (core+vue). | Coverage run (core+vue). |
| `test:datagrid:tree:contracts` | Точечные tree/group/event contract-тесты. | Targeted tree/group/event contract tests. |
| `test:e2e:datagrid:tree` | E2E must-have для tree сценария. | Tree e2e must-have scenario. |
| `test:e2e:datagrid:parity` | E2E parity между datagrid/vue/laravel сценариями. | E2E parity across datagrid/vue/laravel flows. |

## 4) Codemod

| Script | RU | EN |
|---|---|---|
| `codemod:datagrid:public-protocol` | Массовая миграция к публичному protocol/API контракту. | Bulk migration to public protocol/API contract. |

## 5) Benchmark scripts

`*:assert` = тот же benchmark + бюджетные пороги (`PERF_BUDGET_*`) и fail при нарушении.

| Script | RU: что проверяет / на что смотреть | EN: what it validates / what to watch |
|---|---|---|
| `bench:datagrid:interactions` | Selection drag/fill/edit интеракции. Смотрим latency p95/p99. | Selection drag/fill/edit interactions. Watch p95/p99 latency. |
| `bench:datagrid:interactions:assert` | То же + strict budgets по selection/fill, variance, heap. | Same + strict budgets for selection/fill, variance, heap. |
| `bench:datagrid:browser-frames` | UI frame-time/fps/dropped frames при скролле базового grid. | UI frame-time/fps/dropped frames under base-grid scrolling. |
| `bench:datagrid:browser-frames:assert` | То же + budgets для frame p95/p99, fps, long tasks. | Same + budgets for frame p95/p99, fps, long tasks. |
| `bench:datagrid:harness` | Локальный агрегатор бенчей (local mode). | Local benchmark harness (local mode). |
| `bench:datagrid:harness:ci` | CI-конфигурация harness. | CI harness configuration. |
| `bench:datagrid:harness:ci:gate` | CI harness + автоматическая проверка итогового отчета. | CI harness + automatic benchmark-report gate. |
| `bench:datagrid:rowmodels` | Производительность client/server row model операций (range/window shift). | Client/server row model operation performance (range/window shift). |
| `bench:datagrid:rowmodels:assert` | То же + budgets по client/server p95/p99, variance, heap. | Same + budgets for client/server p95/p99, variance, heap. |
| `bench:datagrid:datasource-churn` | Поведение datasource при churn (scroll/filter bursts, pull coalescing/defer). | Data source behavior under churn (scroll/filter bursts, pull coalescing/defer). |
| `bench:datagrid:datasource-churn:assert` | То же + budgets + min coalesced/deferred pull. | Same + budgets + minimum coalesced/deferred pull checks. |
| `bench:datagrid:derived-cache` | Эффективность derived cache (hit/miss stable vs invalidated). | Derived cache efficiency (hit/miss in stable vs invalidated states). |
| `bench:datagrid:derived-cache:assert` | То же + budgets на hit-rate/miss/latency/heap. | Same + budgets for hit-rate/miss/latency/heap. |
| `bench:datagrid:pivot` | Pivot workload (rebuild/patch/reapply). | Pivot workload (rebuild/patch/reapply). |
| `bench:datagrid:pivot:assert` | То же + budgets для pivot rebuild/frozen/reapply. | Same + budgets for pivot rebuild/frozen/reapply paths. |
| `bench:datagrid:pivot:stress:50k` | Стресс pivot на 50k с расширенной кардинальностью. | 50k pivot stress with higher cardinality. |
| `bench:datagrid:dependency-graph` | Производительность dependency graph expansion/affect propagation. | Dependency graph expansion/affected propagation performance. |
| `bench:datagrid:dependency-graph:assert` | То же + budgets на register/expand/affected mean/heap. | Same + budgets for register/expand/affected mean/heap. |
| `bench:datagrid:hardcore` | Смешанный heavy workload: cold-start/sort/filter/patch storm. | Mixed heavy workload: cold start/sort/filter/patch storm. |
| `bench:datagrid:hardcore:assert` | То же + широкие бюджеты стабильности/throughput/memory. | Same + broad stability/throughput/memory budgets. |
| `bench:datagrid:soak` | Длинная сессия (устойчивость + memory growth drift). | Long-running soak (stability + memory growth drift). |
| `bench:datagrid:soak:assert` | То же + budgets по op p95, heap delta, growth per 1k ops. | Same + op p95, heap delta, growth-per-1k-ops budgets. |
| `bench:datagrid:group-depth` | Нагрузка на глубокие grouping trees (expand/collapse/rebuild). | Deep grouping tree load (expand/collapse/rebuild). |
| `bench:datagrid:group-depth:assert` | То же + budgets на rebuild/expand/collapse глубину и heap. | Same + budgets on rebuild/expand/collapse depth and heap. |
| `bench:datagrid:pivot:server-interop` | Interop pivot + server workflows (pull/export/import/drilldown). | Pivot + server interop (pull/export/import/drilldown). |
| `bench:datagrid:pivot:server-interop:assert` | То же + budgets на server pull, import/export, drilldown. | Same + budgets for server pull, import/export, drilldown. |
| `bench:datagrid:worker:protocol` | Worker protocol correctness/latency/roundtrip behavior. | Worker protocol correctness/latency/roundtrip behavior. |
| `bench:datagrid:worker:protocol:assert` | То же + budgets на stale/loading/roundtrip/variance/heap. | Same + budgets for stale/loading/roundtrip/variance/heap. |
| `bench:datagrid:worker:frames` | Browser frames A/B (main-thread vs worker-owned) в sandbox. | Browser frame A/B (main-thread vs worker-owned) in sandbox. |
| `bench:datagrid:worker:frames:assert` | То же + budgets по drift/drop/frame p95/p99. | Same + budgets for drift/drop/frame p95/p99. |
| `bench:datagrid:worker:ux` | UX pressure A/B: frame+dropped+event-loop-lag+longtask under load. | UX pressure A/B: frame+dropped+event-loop-lag+longtask under load. |
| `bench:datagrid:worker:ux:assert` | То же + budgets по event-loop/longtask/frame drift/variance. | Same + budgets for event-loop/longtask/frame drift/variance. |
| `bench:datagrid:worker:pressure` | Heavy pressure A/B (patch/sort/filter + frame impact). | Heavy pressure A/B (patch/sort/filter + frame impact). |
| `bench:datagrid:worker:pressure:assert` | То же + budgets по total/frame drift/variance. | Same + budgets for total/frame drift/variance. |
| `bench:datagrid:worker:pressure:assert:matrix` | Матрица размеров (10k..200k) для pressure assert. | Size matrix (10k..200k) for pressure assert. |
| `bench:datagrid:worker:pressure:assert:matrix:scaled` | Матрица rows+patchSize (scaled pressure). | Rows+patchSize matrix (scaled pressure). |
| `bench:datagrid:tree` | Tree workload: expand + filter/sort bursts. | Tree workload: expand + filter/sort bursts. |
| `bench:datagrid:tree:assert` | То же + budgets по expand/filter-sort p95/p99/heap/variance. | Same + expand/filter-sort p95/p99/heap/variance budgets. |
| `bench:datagrid:tree:ci-light` | Облегченный tree benchmark для быстрого CI feedback. | Lightweight tree benchmark for fast CI feedback. |
| `bench:datagrid:tree:stress` | Тяжелый tree stress (больше rows/итераций). | Heavy tree stress (higher rows/iterations). |
| `bench:datagrid:tree:matrix` | Matrix benchmark по row-size для tree workload. | Tree workload matrix across row sizes. |
| `bench:datagrid:tree:matrix:assert:ci` | CI матрица (укороченный набор строк и budgets). | CI matrix (reduced row set + budgets). |
| `bench:datagrid:tree:matrix:assert:nightly` | Nightly матрица (широкий row-range и строгий budget mapping). | Nightly matrix (wider row range + strict budget mapping). |
| `bench:datagrid:tree:matrix:assert` | Полный assert matrix c output JSON. | Full assert matrix with output JSON. |

## 6) Quality / acceptance scripts

| Script | RU | EN |
|---|---|---|
| `quality:perf:datagrid` | Проверка perf-контрактов/порогов по отчетам. | Checks perf contracts/thresholds from reports. |
| `quality:architecture:datagrid` | Набор architecture/docs/API boundary проверок. | Bundle of architecture/docs/API boundary checks. |
| `quality:facade:datagrid` | Проверка покрытия facade API (fail при нарушении). | Facade API coverage check (fails on violations). |
| `quality:facade:datagrid:report` | Отчет по покрытию facade без жесткого fail-gate. | Facade coverage report without strict fail gate. |
| `quality:gates:datagrid:tree` | Композитный tree-gate: contracts + e2e + tree benches. | Composite tree gate: contracts + e2e + tree benches. |
| `quality:lock:datagrid` | Главный lock-гейт качества (architecture+perf+contracts+gates). | Main quality lock gate (architecture+perf+contracts+gates). |
| `quality:lock:datagrid:parity` | Lock-гейт + bench regression + e2e parity. | Lock gate + bench regression + e2e parity. |

## 7) Standalone scripts in `/scripts` (not always wired in `package.json`)

| Script file | RU | EN |
|---|---|---|
| `bench-livewire-morph.mjs` | Бенч Livewire morph/DOM patch сценариев. | Bench for Livewire morph/DOM patch scenarios. |
| `bench-vue-adapters.mjs` | Бенч накладных расходов Vue adapter слоев. | Bench for Vue adapter overhead. |
| `bench-datagrid-worker-pressure-matrix.mjs` | Генератор matrix/scaled запусков worker pressure. | Matrix/scaled runner for worker pressure benchmark. |
| `check-datagrid-benchmark-report.mjs` | Валидация агрегированного benchmark report JSON. | Validates aggregated benchmark report JSON. |
| `check-datagrid-commercial-release-channel.mjs` | Проверяет policy release-channel/tag/branch. | Validates release-channel/tag/branch policy. |
| `check-datagrid-commercial-tarball-boundaries.mjs` | Проверка tarball boundary (утечки/экспорты). | Tarball boundary check (leaks/exports). |

## 8) Мини-гайд запуска / Minimal run guide

- RU: Локальная база качества: `pnpm run check`
- EN: Local baseline quality: `pnpm run check`
- RU: Быстрый tree-гейт: `pnpm run quality:gates:datagrid:tree`
- EN: Fast tree gate: `pnpm run quality:gates:datagrid:tree`
- RU: Worker pressure matrix scaled: `pnpm run bench:datagrid:worker:pressure:assert:matrix:scaled`
- EN: Worker pressure matrix scaled: `pnpm run bench:datagrid:worker:pressure:assert:matrix:scaled`
- RU: Worker UX pressure (реальная отзывчивость): `pnpm run bench:datagrid:worker:ux:assert`
- EN: Worker UX pressure (real responsiveness): `pnpm run bench:datagrid:worker:ux:assert`
- RU: Полный lock перед релизом: `pnpm run quality:lock:datagrid:parity`
- EN: Full pre-release lock: `pnpm run quality:lock:datagrid:parity`
