# Строгий аудит DataGrid: производительность, архитектура и сравнение с AG Grid Enterprise

Дата: 2026-09-07. Проверенный commit: `9c79456d86c58d5c1c37e925239c08328a84f67a`.
Статус: аудит завершён; gaps закрываются отдельными slices. HP-01 закрыт в текущей ревизии.
Назначение: самостоятельный документ для подготовки отдельных промптов на закрытие gaps.

## 1. Вердикт

**Сейчас нельзя обоснованно утверждать «не хуже AG Grid Enterprise», тем более «лучше».** Причина не в отсутствии хорошей основы: она есть. Причина — воспроизводимый отказ на большом дереве, резкий рост стоимости точечных обновлений при активной сортировке, недостаточная строгость браузерных gates и отсутствие воспроизводимого сравнения с конкурентом.

Наиболее существенные результаты этого аудита:

- Раскрытие одной ветки с 150 000 листьями воспроизводимо завершается `RangeError: Maximum call stack size exceeded`.
- Изменение **одного поля, не участвующего в сортировке**, на 100 000 строках занимает в локальном probe p50 **23,97 ms**, p95 **42,22 ms**; на 300 000 — p50 **84,74 ms**, p95 **213,57 ms**. Та же операция на плоской таблице без сортировки — около **0,0035 ms p50**. Это стоимость модели без Vue, DOM и paint.
- CI harness задаёт frame p95 **180 ms**, допустимый `droppedFramePct` **100%**, одну браузерную сессию и не включает обязательный fail для browser-resource warnings в своём профиле. Такой gate проверяет отдельные ограничения, но не гарантирует плавный интерфейс.
- Сохранённый браузерный `.assert.json` от 2026-05-20 имеет `ok: true` при примерно **15,28 FPS** для тяжёлых рендереров. Это исторический результат, а не свежий замер текущего commit.
- 173 выбранных unit/contract-теста проходят. Их успех не покрывает найденное падение на широкой ветке и не является доказательством browser-performance parity.

Рекомендуемая стратегия: сначала устранить подтверждённые дефекты и сделать измерения строгими, затем оптимизировать конкретные workloads. Переписывание всей таблицы, замена DOM на canvas или создание нового универсального runtime из этого аудита не следуют.

## 2. Область и сила доказательств

### Что проверено

- `@affino/datagrid-core`: client row model, projection/patch pipeline, tree/pivot, server cache, viewport/virtualization.
- `@affino/datagrid-vue`: app viewport, row-height metrics, основные границы адаптера.
- `@affino/datagrid-vue-app`: materialization, panes, cell renderers, подключение row model.
- `@affino/datagrid-worker`: worker-owned proxy/host, сообщения, кеширование окон.
- Связанные контракты `datagrid-pivot`, server-adapters; scripts, CI, существующие perf artifacts и документация.

Это выборочный аудит критических путей, **не построчная проверка всего монорепозитория**. Backend SQL/Postgres, формульный движок целиком, XLSX, charts, Gantt, полноценная security/a11y certification в эту проверку не входят. Наличие пакета или функции не считается доказательством её конкурентного паритета.

### Обозначения

- **R — reproduced:** выполнен свежий probe и получен результат.
- **C — code:** свойство непосредственно следует из текущего кода; стоимость/UX-эффект могут требовать профилирования.
- **H — historical:** вывод из сохранённого артефакта другой даты без подтверждения соответствия текущему commit.
- **V — verification gap:** требуемое доказательство отсутствует в проверенной области.

Приоритеты: **P1** — исправлять в первую очередь / блокирует соответствующее enterprise-обещание; **P2** — следующий архитектурный или performance slice; **P3** — только после измерений. P0 не присваивается автоматически каждому отставанию от конкурента: универсальное production-падение или потеря данных здесь не установлены.

Время в локальных probes — ориентир этой среды, не переносимый SLA. Среда: Linux arm64, Node 22.23.2, pnpm 10.30.3, 10 логических CPU, около 7,82 GiB RAM; модель CPU не предоставлена. CI использует Node 20. CPU quota, browser/device performance и загрузка хоста не нормализованы.

### Ограничения

- Новый browser trace не снимался: executable Chromium, ожидаемый установленным `@playwright/test`, отсутствует (`/home/vscode/.cache/ms-playwright/chromium-1208/chrome-linux/chrome`). Новые браузеры/зависимости для аудита не устанавливались.
- AG Grid не запускался. Его документация сверена по официальным страницам, отображавшим версию 36.1.0 на дату аудита. Это подтверждает механизмы и возможности, а не сравнительные числа.
- Старые артефакты не выбирались по принципу «лучший успешный результат». Ни один их FPS не переносится на текущую ревизию.
- Production-код, public API и thresholds не менялись. Использованы инструкции `affino-performance` для проверки конкретных горячих путей и `affino-docs` для разделения фактов, гипотез и критериев закрытия.

## 3. Что в архитектуре уже хорошо

1. Core не зависит от Vue; API, orchestration, adapter и mounted app разделены. Сохранять это разделение.
2. Плоский client patch имеет настоящий быстрый путь: индекс `rowId → source index`, изменение затронутых row nodes, повторное использование проекций. Нельзя писать, что каждый patch всегда копирует весь dataset: это неверно. См. `clientRowPatchCoordinatorRuntime.ts:117`, `clientRowPatchHostRuntime.ts:100`.
3. Есть dependency-aware invalidation, row revisions, sort-value cache, scalar single-sort path, инкрементальные aggregation/pivot paths. Улучшения должны расширять их применимость.
4. Viewport уже использует rAF, сохранение render window, hysteresis, адаптивный overscan, быстрый выход при неизменном scroll offset. Утверждение «нужно просто добавить rAF» не является корректным диагнозом.
5. Body shell recycling отделён от идентичности stateful renderer content. `DataGridCellContentRenderer.ts` сохраняет row-keyed поведение для компонентов и интерактивных native элементов. Оптимизации не должны переносить editor/component state между строками.
6. Datasource имеет отмену, приоритеты, placeholders, stale retention, cache limits и revision-aware операции. Worker имеет coalescing и отсечение устаревших updates. Это существующие системы, а не отсутствующие функции.
7. Есть полезные contract/stress tests и большой benchmark harness. Проблема — полнота сценариев, строгость порогов и интерпретация результатов.

## 4. Реестр gaps

| ID | Приоритет | Основание | Gap | Основной владелец |
| --- | --- | --- | --- | --- |
| HP-01 | P1 | R/C | Падение раскрытия большой tree-ветки | core/tree |
| HP-02 | P1 | R/C | Точечный patch превращается в обход больших проекций | core/projection |
| HP-03 | P1 | C/H | CI не гарантирует заявленную плавность и latency | scripts/CI |
| HP-04 | P1 | V | Нет воспроизводимого сравнения с AG Grid | benchmark/sandbox |
| HP-05 | P1 для massive rows | C/V | Не обнаружено масштабирования logical scroll за пределами DOM height | core viewport + Vue app |
| HP-06 | P1 для wide grids | C | Колонки не виртуализируются по умолчанию; zero-width fallback материализует все | Vue app + Vue viewport |
| HP-07 | P1 для custom renderers | C/H | Тяжёлый authored renderer выполняется синхронно в render pass | Vue app/rendering |
| HP-08 | P1 для high-cardinality pivot | C | Плотная материализация pivot-output без явного ограничения результата | core/pivot + pivot contracts |
| HP-09 | P2 | C | Каноническая геометрия дублируется между core и Vue | core viewport + Vue |
| HP-10 | P2 | C | Tree toggle копирует flattened projection и перестраивает хвост индекса | core/tree |
| HP-11 | P2 | C | Восстановление viewport по rowId сканирует dataset | Vue viewport |
| HP-12 | P1/P2 | C/V | Worker host не завершает ошибочные команды протокольным ответом; payload/backpressure gaps | worker |
| HP-13 | P2 | C/V | Cache policy плохо масштабируется при защите больших диапазонов; нет hierarchical stores | core/server |
| HP-14 | P2 | C | Row-height update имеет линейный хвост по chunks | Vue row metrics + core view |
| HP-15 | P2 | C/V | Модульность пакетов не доказывает малый kernel/startup footprint | core + packaging |
| HP-16 | P2 | C | Обычная замена rows/options запускает полную нормализацию или remount | Vue app integration |

### HP-01. Раскрытие большой ветки падает

- **Код:** `packages/datagrid-core/src/models/tree/treeProjectionRuntime.ts:1446` и `:1545`: `splice(...nextDescendants)` передаёт всех потомков отдельными аргументами функции.
- **Воспроизведение:** path tree, 150 000 строк с `path: ['root']`, изначально раскрыто; `collapseGroup(rootKey)` → `expandGroup(rootKey)`. Получен `RangeError` в `tryProjectTreePathSubtreeToggle`. Контроль на 10 000 проходит.
- **Последствие:** отказ поддерживаемой операции на большом, но реалистичном enterprise dataset. Лимит аргументов зависит от JS engine; 150 000 — подтверждённый пример, не универсальная граница.
- **Исправление:** выполнено: subtree replacement собирается через `slice().concat()` без передачи всех потомков как аргументов `splice` для path и parent tree. Сначала узкий fix; смена структуры всего дерева не обязательна.
- **DoD:** выполнено для path и parent 150k focused regression + `bench:datagrid:tree:wide-branch`; повторная validation на 300k path/parent также прошла без RangeError (p50 `63.61ms` / `28.54ms`). Отдельная regression на reorder-блок 150k закрывает аналогичный spread insertion в `clientRowRowsMutationsRuntime.ts`; сборка результата теперь не передаёт большой блок как аргументы функции.
- **Риск:** частично изменённые expansion/cache state при исключении; повторная команда после ошибки покрыта tree regressions. Вставка и reorder сохраняют прежний порядок, row identity и duplicate-id validation.
- **Public API:** изменение не требуется. Зависимости: нет. Размер: S.

### HP-02. Быстрый patch заканчивается при включении сортировки

- **Код:** `models/host/clientRowPatchHostRuntime.ts:100` исключает fast path при sort/filter/group/tree/pivot/aggregation/pagination. Далее `models/projection/clientRowProjectionBasicStages.ts:58` вызывает `remapRowsByIdentity` и создаёт `new Set(previousFilteredRowIds)` даже без пересчёта фильтра. `models/clientRowRuntimeUtils.ts:63` строит массив при обходе всей входной проекции; `preserveRowOrder` с `:83` строит дополнительные индексы и наборы.
- **Сценарий:** streaming updates либо editing одной ячейки при активной сортировке; изменяемое поле не связано с сортировкой. Замораживание порядка не устраняет стоимость обновления представления.
- **Свежий probe:** на 100k — 23,97 ms p50 / 42,22 ms p95; на 300k — 84,74 / 213,57 ms. Исходные строки уже загружены, сортировка уже применена, DOM отсутствует. Это подтверждённый bottleneck модели, а не предположение о Vue.
- **Исправление A:** выполнено для sorted-only patches без затрагивания sort fields: changed row IDs/next rows обновляют затронутые позиции существующих проекций через сохранённый identity index, без remap всего набора. Membership/order и frozen semantics сохраняются.
- **Исправление B:** отдельно оценить пакетирование потоковых patch и обновление sort/filter membership для действительно затронутых ключей. Не подменять A добавлением debounce: одиночная операция останется дорогой.
- **DoD:** закрыт: sorted-unrelated на 100k с 1/100/1000 changed rows имеет отдельный fast path; sorted-key correctness cases покрывают filtered-hidden и pagination; benchmark поддерживает `BENCH_SORTED_PATCH_MODE=sort-key` и `BENCH_SORTED_PATCH_MODE=grouped`; grouped aggregation oracle проверен focused test, а 300k sorted-key workload измерен для 1/100 changed rows. Sorted-key сохраняет полный reorder fallback.
- **Риск:** stale row references, нарушение порядка/frozen policy, некорректные агрегаты и computed fields. Сравнивать с полным recompute как correctness oracle.
- **Public API:** A — не требуется; B — сначала проверить существующие batch/transaction возможности. Новый публичный scheduling API требует отдельного предложения и согласования. Зависимости: измерения HP-03, но A можно начать сразу. Размер: M–L.

### HP-03. Performance gate может быть зелёным при плохом UX

- **Код:** `scripts/bench-datagrid-harness.mjs:307` — CI browser task: 1 session, frame p95 180 ms, dropped-frame 100%, viewport-update p95 180 ms, CV 180%, renderer p95 8 ms **на callback**, до 30 000 cell mounts на scroll write.
- `BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS` в этом профиле не включён; значение по умолчанию в `bench-datagrid-enterprise-browser-frames.mjs:111` — `false`. В `.github/workflows/ci.yml` benchmark job вызывает именно `bench:regression`. Отдельные строгие npm scripts существуют, но их существование не означает выполнение тем же CI job.
- **Факт H:** файл `artifacts/performance/bench-datagrid-enterprise-browser-frames.assert.json`, 2026-05-20: `ok=true`, тяжёлые renderers 83,3 ms frame p95 и 15,28 FPS. Это объяснимо записанными бюджетами, а не доказывает сломанный JSON.
- **Разрыв:** `docs/perf/datagrid-performance-gates.md` заявляет scroll latency <=16 ms и CV<=25%; фактические профили гораздо мягче. Время функции, frame interval и input-to-paint — разные величины, заменять одну другой нельзя.
- **Исправление:** отделить correctness/smoke ceilings от UX-SLO profiles; критичные resource warnings сделать blocking в фактической цепочке CI; budgets по сценариям, минимальный sample count, явный fail при нулевых samples и отсутствии refresh-aware dropped-frame aggregate, raw samples и environment metadata. Не ужесточать пороги вслепую на shared runner. CI harness теперь использует collect-all режим (`BENCH_FAIL_FAST=false`): failure datasource/другого workload не скрывает последующие browser tasks, а aggregate report остаётся красным при любом failed task. Browser runner гарантирует остановку локального sandbox server даже при ошибке `chromium.launch`, поэтому retries не оставляют зависшие Vite processes. Harness распознаёт deterministic Playwright dependency failure и не повторяет заведомо невозможный browser task.
- **DoD:** искусственное нарушение каждого frame/resource бюджета делает CI красным; soft observation явно обозначен. Для smooth scroll отдельные 60/120 Hz профили; teleport stress отдельно. Проверять совокупное renderer time за frame, а не только p95 одного дешёвого callback.
- **Дополнительный дефект интерпретации:** закрыт: legacy `droppedFramePct` сохранён для совместимости, artifact содержит `refreshAwareDroppedFramePct`/`refreshAwareDroppedFrames`, а CI harness теперь запускает browser profile с `BENCH_BROWSER_REFRESH_RATE_HZ=60` и hard-fail refresh-aware rate на `35%`; отдельные 60/120 Hz assert-профили сохраняются для явных device runs (`35%`/`25%`). Фактический запуск зависит от доступного Chromium/CI hardware; пороги являются явными profile budgets, а не переносимым универсальным FPS SLA.
- **Public API:** не требуется; artifact schema может требовать миграции consumers. Зависимости: нет. Размер: M.

### HP-04. Сравнительного стенда AG Grid не обнаружено

- **Область поиска:** scripts, e2e, CI, perf docs, manifests sandbox/showcase. Есть AG-target названия и собственные before/after сравнения; реализация запуска AG Grid в проверенной области не найдена.
- **Последствие:** невозможно сказать, быстрее ли Affino на том же workload, где граница памяти и сколько стоит flexibility. «Enterprise» в имени теста не является сравнением.
- **Исправление:** dev-only comparator fixture дополнен `scripts/check-datagrid-ag-comparator.mjs` и `bench:datagrid:ag-comparator:assert`: checker воспроизводит checksum, проверяет AG Grid `36.1.0`, required profile matrix и явно требует browser/license phase. Dependency не попадает в production packages. Browser timing runner и license-backed Enterprise execution остаются следующим sub-slice.
- **DoD:** manifest contract теперь проверяется deterministic checker-ом на 1k-row smoke; полная матрица из раздела 7 требует одинаковые модель данных, колонки, formatter/renderer complexity, row height, pinned panes, viewport, сортировку и batch latency в production builds. Raw artifacts, commit/version, browser, CPU profile, warmup и порядок прогонов фиксируются. AG Enterprise запускается с корректно предоставленной конфигурацией лицензии.
- **Риск:** сравнить холодный Affino с прогретым AG, plain cells с Vue components, local rows с серверной загрузкой либо batch с per-row update и получить ложную победу. Локальная попытка подключить AG Grid Vue3 `36.1.0` в sandbox выявила требование Vue `useTemplateRef`, которого нет в закреплённом Vue `3.4.38`; comparator должен запускаться в изолированном fixture с совместимой Vue версией, не через production sandbox.
- **Public API:** не требуется. Зависимости: HP-03. Размер: M, затем расширение матрицы.

### HP-05. Большое число логических строк упирается в физическую высоту DOM

- **Код:** `datagrid-vue-app/src/stage/DataGridTableStage.vue:630` задаёт высоту body из `resolveRowOffset(totalRows)` либо `totalRows * baseRowHeight`; `datagrid-vue/src/app/useDataGridAppViewport.ts:1072` преобразует native scrollTop непосредственно в row index. В проверенных core/app путях не обнаружен отдельный mapping logical offset ↔ ограниченный physical scroll extent.
- **Сценарий:** 1M × 100 px = 100M px; server datasource с миллионами строк не решает ограничения DOM сам по себе. Даже при нескольких десятках mounted rows scrollbar требует представимого extent.
- **Статус:** архитектурный риск C/V; конкретная граница и недоступность последней строки в текущем браузере здесь не измерялись. Нельзя заявлять, что 1M строк всегда ломается: при иной высоте и браузере результат другой.
- **Ориентир:** AG Grid документирует измерение browser max height и stretching. Число 32M px на их странице относится к приведённому примеру Chrome, а не является универсальной константой. [Официальное описание](https://www.ag-grid.com/javascript-data-grid/massive-row-count/).
- **Исправление:** design proposal подготовлен: `docs/internal/plans/datagrid-bounded-physical-scroll-design-2026-09-14.ru.md` разделяет logical/physical domains, фиксирует single mapping boundary для scroll/restore/selection/overlays и acceptance matrix для 1M/10M rows. Core теперь содержит pure monotonic mapping и viewport virtualization переводит measured native extent в logical offset при превышении browser limit; identity path сохранён. Browser last-row reachability и полное Vue integration acceptance остаются отдельным slice.
- **DoD:** 1M/10M logical server rows; 24/31/100 px и variable heights; top/middle/last row, thumb drag, keyboard End, scrollToCell, restoration, fractional zoom. Бounded DOM, отсутствие blank gaps и корректные абсолютные индексы.
- **Измерение slice:** 1,000,000 logical↔physical round-trips для 10M rows / native limit 16M выполнены за `4.21ms` в Node 22; scale `0.051613`. Это измерение pure math, не browser scroll acceptance.
- **Integration check:** synthetic controller contract с 50k logical rows и native limit `199,300px` достигает последних logical rows при bottom scroll; mapping/resize suites — `8` tests passed. Это не заменяет real-browser maximum-height measurement.
- **Public API:** сначала внутренний mapping; любые новые публичные координаты согласовать. Зависимости: HP-09. Размер: L.

### HP-06. Wide-grid default и zero-size materialization

- **Код:** `datagrid-vue-app/src/config/dataGridVirtualization.ts:29` задаёт `columns:false`; `true` включает обе оси. `datagrid-vue/src/app/useDataGridAppViewport.ts:970` при `availableWidth<=0` возвращает все колонки даже при включённой column virtualization.
- **Стоимость:** O(renderedRows × allColumns), а не O(renderedRows × visibleColumns). На скрытой вкладке/нулевой начальной ширине возможен дорогой первый render до измерения viewport. Это C, не измеренный в браузере mount spike.
- **Исправление A:** ограниченный zero-size bootstrap window или ожидание валидного measurement с определённым first-paint contract.
- **Исправление B:** понятный wide-grid preset/explicit documented setting; изменение default не проводить молча.
- **DoD:** zero-width 10k column contract (включая полностью zero-width measured grid) и algorithm benchmark покрыты; новый transition contract проверяет bounded window после hide, resize и reorder/pin на 10k columns; browser mounted-cell counts и real visibility/resize/pin acceptance остаются отдельными validation cases.
- **Риск:** initial flash, некорректный autosize скрытых колонок, breaking change default. **Public API/behavior:** для B сначала предложение и согласование. Размер: A — S/M, B — отдельный slice.

### HP-07. Authored renderers могут блокировать каждый render window

- **Код:** `stage/useDataGridStageCellRendering.ts:133` синхронно вызывает renderer; `DataGridTableStageCenterPane.vue:187` вычисляет content при render. Error fallback есть, автоматического переноса тяжёлого renderer после scroll в проверенном пути нет.
- **Последствие:** bound по числу DOM cells не даёт bound по стоимости пользовательского callback. Даже сотни callbacks по долям миллисекунды могут исчерпать frame budget. Исторические тяжёлые сценарии из раздела 6 подтверждают необходимость отдельного профиля, но не дают актуальный FPS.
- **Исправление:** baseline telemetry и renderer-duration budgets уже добавлены для обычных spans, slow custom renderers, pinned и auto-height профилей; runtime defer/placeholder policy вынесена в proposal `docs/internal/plans/datagrid-authored-renderer-defer-design-2026-09-14.ru.md`.
- **Ориентир:** у AG Grid есть `deferRender` для тяжёлых cell components и skeleton до окончания scroll. [Scrolling performance](https://www.ag-grid.com/javascript-data-grid/scrolling-performance/).
- **Текущий статус slice:** `dgPerfTrace=1` записывает `stageRenderWindow`, `cellRenderer`, `groupCellRenderer`; enterprise browser gate проверяет наличие invocation и p95 duration budgets. Internal queue и opt-in wiring покрыты contracts; свежий Chromium run в текущем окружении невозможен, поэтому улучшение FPS/input-to-paint не заявляется.
- **Исправление sub-slice:** internal queue реализует bounded pending queue с приоритетами pinned/visible/overscan, дедупликацией и cancellation stale keys; priority buckets сохраняют FIFO и убирают сортировку полного pending набора на каждом flush; default synchronous renderer path не меняется.
- **Проверки:** queue contract — 3 tests passed; renderer defer contract — 1 test passed; enqueue+flush 512 prioritized cells — 10,835.64 ops/s против 8,047.56 ops/s предыдущей реализации (+34.6%). Browser differential acceptance и measured final-content latency остаются открытыми.
- **DoD:** улучшение input-to-paint и frame tail с сохранением stateful row identity, editor focus, custom events, group renderer semantics, a11y; после остановки скролла окончательный content появляется в ограниченное время. Stateful children нельзя безусловно переиспользовать по viewport slot.
- **Public API:** новый renderer policy сначала предложить и согласовать. Зависимости: HP-03. Размер: M.

### HP-08. Pivot материализует плотную матрицу

- **Код:** `datagrid-core/src/models/pivot/pivotRuntime.ts:555` в `buildPivotRowNode` проходит все `columnOrder` и все value columns для каждой output row, записывая даже отсутствующие значения как `null`. Публичный `DataGridPivotSpec` в `datagrid-pivot/src/contracts.ts:23` не содержит ограничения output cardinality; guard в проверенном build path не найден.
- **Стоимость:** минимум O(Rp × Cp × V) output property work, независимо от горизонтальной DOM virtualization. Rp — output rows, Cp — уникальные pivot tuples, V — value specs. Маленький source с высокой cardinality может породить огромный разреженный результат, который хранится плотно.
- **Исправление A:** выполнено: opt-in `maxOutputCells` добавлен в `DataGridPivotRuntimeOptions` и client row model options; превышение возвращает typed `output-limit-exceeded` diagnostics, пустой результат и не создаёт dense output rows. Projection stage сохраняет предыдущий корректный snapshot.
- **Исправление B, sparse row payload sub-slice:** opt-in sparsePivotOutput для client row model и sparseOutput для runtime пропускают отсутствующие aggregate fields в row payload и удаляют их при value-only patch; dense output остаётся default. Это сокращает object-property materialization для разреженных pivot rows, но не заменяет sparse column store.
- **Исправление B:** design proposal подготовлен: pivot sparse storage, typed missing/null semantics, bounded dense compatibility reads, export/drilldown boundaries и memory invariants. Runtime sub-slice выполнен: opt-in sparsePivotOutput для client row model и sparseOutput для runtime пропускают отсутствующие aggregate fields в row payload, итерируют только присутствующие aggregate column keys и удаляют их при value-only patch; dense output остаётся default. Полный sparse column store, export/read/drilldown integration остаются открытыми.
- **Измерение sub-slice:** workload 10k rows с correlated 100×100 high-cardinality sparse matrix: dense 172.31 ops/s, sparse 193.37 ops/s, 1.12x; это локальный payload benchmark, не browser SLA и не доказательство полной sparse storage.
- **Проверки:** focused pivot runtime contracts проверяют guard на 2-row × 2-column и 50k-row high-cardinality output; stage regression проверяет переход valid→exceeded с сохранением последнего snapshot и typed diagnostics; fresh high-cardinality probe на 50k rows, cardinality 30, 3 value specs и 1 seed дал 2700 output columns, rebuild p95 `55.923ms`, frozen patch p95 `13.475ms`, reapply patch p95 `58.819ms`, heap delta `0.19MB`; core type-check/build проходят. Полный 3-seed stress run в текущем лимите времени не завершил summary и в acceptance result не засчитывается.
- **DoD:** guard срабатывает до dense row materialization и сохраняет fail-closed semantics; отдельные heap peak, browser export/read/drilldown и pinned UI checks остаются для workload expansion.
- **Риск:** несовместимость сериализованного row payload, export, формул, сортировки и custom renderer reads. **Public API:** новые limits/lazy access согласовать. Зависимости: HP-03, для B — оценка HP-15. Размер: A — M, B — L.

### HP-09. Два места определяют геометрию viewport

- **Код:** core `virtualization/verticalVirtualizer.ts`, `viewport/dataGridViewportVirtualization.ts`, horizontal math; одновременно Vue `useDataGridAppViewport.ts:952–1130` сам вычисляет binary-search column window, row range, overscan и retention. Импортируемый core overscan controller не объединяет всю геометрию.
- **Проблема:** часть работы — законная materialization, но row/column offset-to-index и clamp formulas уже относятся к канонической геометрии. Документированный single-owner contract не полностью соответствует фактическому месту вычислений.
- **Последствие:** исправление variable heights, hidden columns, huge scroll или fractional offsets надо согласованно переносить в несколько путей. Пройденный core stress test не гарантирует такой же результат app path.
- **Исправление:** выполнено для горизонтальной оси: core internal helpers `resolveFirstColumnIndexAfterOffset`, `resolveLastColumnIndexBeforeOffset` и prefix-варианты стали каноническими lower-bound операциями; core column sizing и Vue app viewport используют их. В текущем slice uniform vertical offset/index math также вынесена в core internal helpers `resolveUniformRowOffset` и `resolveUniformRowIndexAtOffset`; Vue fallback и core vertical strategy используют тот же owner. Vue сохраняет DOM sampling, refs, scheduling, retention и собственные variable-height boundary semantics.
- **Проверки:** core vertical geometry/overscan contract — 9 tests passed; Vue row-height и viewport contracts — 54 tests passed; core и Vue type-check/build проходят. Проверены пустые, fractional, terminal и non-finite offsets; benchmark row-height metrics на 200k rows показал 2033.17x для sparse mutation против full prefix rebuild.
- **DoD:** горизонтальная и uniform vertical offset-to-index формулы имеют single internal owner; variable-height sparse metrics, overscan/materialization и DOM scheduling остаются отдельными владельцами и требуют differential/browser slices. Desktop/touch behavior не менялся.
- **Риск:** timing changes при механическом объединении math и scheduling. **Public API:** предпочтительно внутренние helpers. Зависимости: нет; ограничивать slice одной областью. Размер: M–L.

### HP-10. Локальный tree toggle имеет глобальную стоимость

- **Код:** `treeProjectionRuntime.ts:1435`/`:1534` — `input.rows.slice()`, далее insertion и `rebuildGroupIndexByRowIdFrom`; `:1337` проходит group-index map и оставшийся хвост rows.
- **Стоимость:** O(P) копирование flattened projection и обработка хвоста даже при изменении небольшой ветки в начале. P — количество видимых логических строк, не DOM window. Исправление HP-01 само по себе это не устранит.
- **Исправление:** выполнен безопасный sub-slice: `replaceProjectionSegment` теперь делает одну копию projection и выполняет bounded manual shift/insert без промежуточных prefix/suffix arrays и без spread argument limit. Production path дополнительно убрал вторую полную копию при обновлении state group row: immutable snapshot создаётся одной заменой, затем изменяется только соответствующая позиция. Добавлен internal chunked sequence proof-of-concept с локальным range replacement. Production fast paths обновляют group index через delta по удалённому/вставленному subtree и сдвигают последующие entries без повторного прохода по flattened row suffix; array projection oracle сохраняется до differential sequence integration. Chunked proof-of-concept дополнительно использует binary search по chunk starts для indexed reads после variable-length replacements.
- **Проверки sub-slice:** 2 chunked contracts passed; production client/tree regressions — 141 tests passed. Свежий `bench:datagrid:tree:wide-branch` на 150k rows / 3 iterations после устранения двойной копии: path p50 `15.89ms`, parent p50 `13.18ms`; это local measurement, не SLA. 300k-row benchmark indexed read `12,099,449.44 ops/s`, array oracle replacement `6,425.38 ops/s`, chunked replacement `217,476.44 ops/s`. Heap profile на 300k rows / 5 toggles показал peak над baseline `+2.48MB` path и `+2.33MB` parent; после dispose heap delta `-110.30/-50.81MB`, поэтому peak, а не post-dispose delta — релевантный показатель. Production chunked sequence integration остаётся открытой.
- **DoD:** correctness regression suite проходит (`149` focused core tests); group-depth workload `20k` rows / depth `5` / cardinality `12` измерен после изменения: rebuild p95 `28.943ms`, expand p95 `113.541ms`, collapse p95 `6.805ms`. POC contract сравнивает порядок с array oracle; на 300k rows замена одной строки показала `586820.08` против `5554.23` ops/s у copy+splice (`105.65x`). Production wide-tree run на 300k rows после delta index update: path p50 `56.45ms`, parent p50 `64.77ms` при 5 iterations; repeated path/parent toggle sequence contract покрывает 80 локальных replacements и восстановление полного порядка. Свежий 150k wide-branch run (3 iterations) дал path p50 `26.43ms`, parent p50 `20.23ms`; это measurements, а не SLA. Большая subtree replacement, heap/allocations и production differential sequence integration остаются следующими этапами.
- **Public API:** не требуется при сохранении snapshot invariants. Зависимости: HP-01. Размер: M/L.

### HP-11. Viewport restore по rowId выполняет линейный поиск

- **Код:** `datagrid-vue/src/app/useDataGridAppViewport.ts:1141`, `resolveBodyRowIndexById`, перебирает `getBodyRowAtIndex` от 0 до total; используется в `resolveViewportPositionScrollTop`.
- **Сценарий:** восстановление сохранённого viewport около конца большого dataset. Для sparse model особенно нежелательно искать ненайденный ID перебором unloaded rows; то, вызовет ли это loads, зависит от реализации getter и требует теста.
- **Исправление:** выполнено: app viewport использует существующую runtime rowId index/capability, сохраняя bounded fallback для runtimes без resolver.
- **DoD:** runtime resolver и отсутствие getter scan покрыты focused contract; algorithm benchmark на 1M строках показывает 161363x выигрыш; новый Vue contract покрывает last-row и missing-id на 1M sparse logical rows без fallback scan, включая runtime resolver при отсутствии `getBodyRowAtIndex`. Browser restore acceptance остаётся отдельным workload check.
- **Public API:** сначала найти внутренний доступ; новый locate API согласовать. Зависимости: HP-09 при изменении геометрии. Размер: S/M.

### HP-12. Worker: ошибки host и стоимость обмена

- **Код P1:** `datagrid-worker/src/workerOwnedRowModelHost.ts:154` вызывает `executeCommand` и затем `emitUpdate` без try/catch/error reply. Исключение в model command, getter или `postMessage` прерывает обработчик до ответа. В worker-owned proxy не обнаружено timeout/error-event завершения такого request. Обработка локального `DataCloneError` при dispatch — другой случай и не закрывает host failure.
- **Последствие:** команда может остаться без подтверждения/диагностики; для viewport запроса возможен незавершённый loading. Это C/V: браузерный worker failure в этой сессии не инжектировался. HP-01 даёт реалистичный источник model exception.
- **Исправление A:** выполнено: host command exceptions возвращают тот же `requestId` с `snapshot.error` и `loading=false`, а proxy сбрасывает pending viewport/loading state при `error` и `messageerror`, сохраняя существующий update protocol shape.
- **Код P2:** каждый host command возвращает snapshot + visibleRows + aggregation/formula metadata (`workerOwnedRowModelHost.ts:123`). `postMessageTransport.ts:15` не предоставляет transfer-list в target contract. Proxy кеширует до 8 окон и дополнительно клонирует row nodes (`workerOwnedRowModel.ts:522`). Coalescing уже есть, но microtask batch не является ограничением числа команд в полёте при длительном worker compute.
- **Исправление B:** measurement sub-slice выполнен: worker protocol artifact сохраняет command/update payload bytes (min/mean/p95/p99), roundtrip/ack lag и aggregate `maxInflightCommands` для correctness и throughput strategies; raw per-run данные остаются в том же JSON. Benchmark freshness gate теперь сравнивает каждый worker source с соответствующим compiled implementation, поэтому старый timestamp barrel `dist/index.js` не даёт ложный stale failure. Свежий assert после worker build: roundtrip p95 `90.18ms`, split dispatch drift p95 `1.61%`, `maxInflightCommands=23`, heap delta `1.20MB`. Delta payload для unchanged window/metadata, viewport priority и backpressure не вводились. Transferables полезны для подходящего columnar payload, а не автоматически для любых object rows.
- **DoD:** host exception, uncloneable row reply и worker termination error покрыты worker regression tests; при неудаче structured clone отправляется metadata-only terminal update с тем же `requestId`; lost response покрыт transport timeout contract (`inflight` возвращается к `0`, `timedOut` увеличивается); controlled reverse burst на 40 delayed updates сохраняет только newest snapshot (`updatesApplied=1`, `updatesDroppedStale=39`). Slow worker + rapid scroll/patch bursts с реальным browser worker остаются отдельными validation cases.
- **Диагностический gap:** закрыт: `getSparseRowModelDiagnostics` считает уникальные cached row IDs по visible rows и всем окнам; overlap/dedup semantics покрыты regression test.
- **Исправление B, lifecycle sub-slice:** закрыт race, при котором synchronous ack мог прийти до регистрации pending request; pending теперь регистрируется до `postMessage`, а synchronous ack и thrown transport error корректно очищают inflight state и обновляют error stats.
- **Исправление B, bounded queue sub-slice:** последовательные non-coalescible commands (например, group toggles) принудительно flush-ятся при очереди `64`; user commands не отбрасываются, coalescing и large patch threshold сохранены. Contract фиксирует 100 toggle commands при `queuePeak=64`.
- **Исправление B, compute backpressure sub-slice:** postMessage compute transport ограничивает unacknowledged requests до `32`; после cap возвращает `handled:false`, и существующий core runtime выполняет synchronous fallback. Contract фиксирует 40 requests, 32 отправленных и 8 fallback без роста inflight. Row-model command protocol не изменён.
- **Исправление C, visible-window delta sub-slice:** row-model protocol schema `4` передаёт для неизменившегося viewport только `{ index, row }` для изменившихся позиций; при смене диапазона или большом числе изменений сохраняется full-window payload. Proxy применяет delta только к тому же диапазону и сохраняет full fallback для старых/неполных сообщений. Contract проверяет patch одного ряда через delta и зеркальную корректность. Vitest serialization benchmark на 200-row window: full `14,664.26 ops/s`, one-row delta `1,202,674.38 ops/s` (`82.01x`); это JSON serialization proxy, не browser postMessage trace.
- **Исправление D, structural metadata sub-slice:** row-model patch response помечается `metadataMode: "unchanged"` и не повторяет aggregation model, formula fields и execution plan; proxy сохраняет предыдущие значения, а model-change responses остаются full. Contract проверяет сохранение structural metadata и row correctness; schema обновлена до `4`.
- **Остаётся:** transfer-list для подходящих columnar payloads и slow worker + rapid scroll/patch bursts с реальным browser worker остаются отдельными validation cases.
- **Public API:** новые transport/protocol поля и target signature сначала предложить и согласовать. Зависимости: A независим; B после HP-03. Размер: A — M, B — M/L.

### HP-13. Server cache: eviction и иерархия

- **Код:** `core/models/server/dataSourceCacheManager.ts:72` для каждого eviction снова ищет первый незащищённый index. Если все защищены, удаляет первый даже из protected ranges. `dataSourceBackedRowModel.ts:500` вызывает enforcement при каждой записи row. Отдельный `rangeCache.ts:151` тоже ищет eviction candidate проходом по chunks.
- **Стоимость/риск:** при P защищённых начальных записях и E вытеснениях поиск может приблизиться к O(P×E). Это не означает, что default 4096-row cache уже bottleneck: нужна pressure-матрица. Кеши хранят дополнительные индексы/ссылки; полного дублирования row payload этим не доказано.
- **Исправление A:** выполнено: `enforceLimit` собирает eviction candidates одним проходом за вызов, а `rangeCache.evictChunks` использует индексированный LRU min-heap вместо сортировки всех chunks при каждом overflow; loading chunks сохраняются; при полном покрытии protected ranges cache теперь сохраняет overflow до следующего eligible transition вместо удаления защищённых rows. Это явное изменение overflow semantics в пользу viewport correctness.
- **Измерение:** datasource churn baseline на 220k rows: p95 scroll-burst 0.630ms при cache limit 4096; pressure profile с limit 256 — 0.858ms, без blank viewport и с cache hit ratio 1.0. После batched range-cache eviction короткий profile на 10k rows / 20 scroll iterations показал p95 scroll-burst 2.125ms, p95 filter-burst 1.147ms, cache hit ratio 1.0; artifact сохранён в `/tmp/datagrid-range-cache-pressure.json`. Свежий synthetic churn после heap перехода (50k setRow + periodic reads) сохранил cap 64/256/1024 chunks и занял 20.089/24.748/25.766ms; отдельный 10k-row manager pressure run с protected fraction 0/0.5/1 занял 3.631/5.880/6.453ms и сохранил 256/5000/10000 rows соответственно; это локальная asymptotic check, не browser SLA.
- **Иерархия:** datasource содержит branch/tree/pivot context, но проверенный cache keyed глобальными числовыми индексами. Отдельные root/group stores с независимым lifecycle, budgets и eviction не обнаружены. Нельзя описывать это как отсутствие серверных tree/pivot protocol fields — они есть.
- **Исправление B:** design proposal подготовлен: `docs/internal/plans/datagrid-server-hierarchical-cache-design-2026-09-14.ru.md` фиксирует store identity, revision ownership, lifecycle, общие budgets, protected viewport и stale-reply invariants. Internal `DataSourceCacheStoreRegistry` реализует первый lifecycle sub-slice: signature-gated retained reuse, generation-safe invalidation и LRU eviction retained stores; row-model wiring и protocol/payload boundary остаются открытыми. Regression на 1000 retained touches и benchmark 10k acquire/retain/enforce операций при cap 64 занял `3.0506ms mean` и завершился ровно с 64 retained stores. AG Grid описывает root cache и cache для каждого уровня grouping. [SSRM Configuration](https://www.ag-grid.com/javascript-data-grid/server-side-model-configuration/).
- **Исправление B, context ownership sub-slice:** cache entries запоминают normalized request state key; background cache-hit проверка теперь не принимает rows из root/старого group context за валидный hit текущего projection. Legacy visible stale-row retention сохранён.
- **Проверки sub-slice:** datasource row-model contracts 81 passed; one-seed churn baseline на 220k rows: scroll-burst p95 7.128ms, filter-burst p95 3.104ms, cache hit ratio 1.000, heap delta 0.09MB. Это consistency и local churn evidence, не hierarchical store integration.
- **DoD:** small/large cache, visible window larger than limit, overscan, reverse scroll, slow/out-of-order replies, selective invalidation; отдельно branch collapse/reopen, соседние stores и memory caps.
- **Public API:** A по возможности внутренний; B требует согласованного протокольного предложения. Зависимости: A — HP-03 для замеров; B — отдельное архитектурное решение. Размер: A — M, B — L.

### HP-14. Переменные высоты: sparse не означает O(log N) update

- **Код:** `datagrid-vue/src/app/dataGridRowHeightMetrics.ts` хранит sparse row deltas по chunks размером 256; обновление изменённого chunk теперь обслуживается внутренним Fenwick tree префиксных сумм.
- **Стоимость:** sparse single mutation — O(log(N/256)), offset lookup получает chunk prefix за O(log(N/256)) и сохраняет bounded scan внутри chunk; fallback без snapshot по-прежнему строит полный prefix O(N). Constant-height path сохранён.
- **Сценарий:** repeated autosize/resize возле начала 1M-row table больше не проходит линейный suffix массива chunks.
- **Измерение:** benchmark harness теперь параметризуется через `DATA_GRID_ROW_HEIGHT_BENCH_ROWS`, `DATA_GRID_ROW_HEIGHT_BENCH_OVERRIDES` и `DATA_GRID_ROW_HEIGHT_BENCH_UPDATES`; baseline 200k rows / 5k overrides / 64 updates: full prefix rebuild 6.85 ops/s, sparse Fenwick path 3,124 ops/s, 456.01×.
- **1M contract slice:** 1,000,000 rows с sparse overrides в начале/середине/конце и последующей mutation покрыты contract test; resolver не вызывает per-row fallback, offset/inverse lookup сохраняют корректные абсолютные границы.
- **1M measurement:** baseline `docs/perf/datagrid-row-height-1m-baseline.json`: dense prefix rebuild `1.2186 ops/s`, sparse Fenwick path `2,610.53 ops/s`, `2,142.30×`; это Node measurement при 1M rows / 5k overrides / 64 updates.
- **DoD:** offsets и inverse lookup против contract oracle, sparse mutation regression, 1M sparse contract, 1M measurement и package type-check проходят; dense/1M browser trace и pinned-pane alignment остаются отдельными workload checks.
- **Public API:** внутреннее изменение возможно; общий core/Vue geometry contract — HP-09. Размер: M. Не ставить выше HP-01/02 только из-за лучшей асимптотики.

### HP-15. Модульность и размер базового runtime ещё надо доказать

- **Код:** core зависит от formula-engine, pivot и projection-engine. `models/clientRowModel.ts:418`, `:432`, `:515`, `:838` создаёт compute/formula-related runtimes в общем composition path; stage registry фиксирован (`clientRowProjectionStageRegistry.ts:59`).
- **Вывод C/V:** физическая декомпозиция файлов/пакетов не гарантирует, что plain-grid consumer не оплачивает неподключённые возможности. Реальные bundle bytes и startup allocations здесь не измерены, поэтому «слишком большой bundle» пока не доказанный факт.
- **Исправление A:** выполнено как measurement-only slice: `scripts/bench-datagrid-package-footprint.mjs` измеряет documented core/Vue/app/pivot/worker entrypoints, полный production `dist` footprint, gzip/Brotli и isolated Node import startup; artifact — `artifacts/performance/bench-datagrid-package-footprint.json`. Замер явно отделяет package footprint от consumer-specific tree-shaken bundle.
- **Результат A:** core plain/advanced — `2,352,062` raw bytes / `360,657` gzip / `227,057` Brotli, startup p50 `55.42/53.89ms`; Vue plain/advanced — `490,551/80,330/62,481`, `124.65/123.26ms`; Vue app — `887,733/183,632/145,224`, `158.39ms`; pivot — `27,289/5,365/4,835`, `5.21ms`; worker — `54,517/9,628/8,298`, `51.47ms` (Node 22, 3 isolated imports). Эти числа служат baseline для следующего design slice.
- **Исправление B:** design proposal подготовлен: `docs/internal/plans/datagrid-lazy-runtime-initialization-design-2026-09-14.ru.md` требует consumer-specific tree-shaken fixtures, parse/evaluate/create-dispose/heap measurements и сохраняет synchronous public factory semantics. Runtime slices выполнены: column histogram создаётся лениво при первом `getColumnHistogram`, pivot runtime — при первом pivot operation, aggregation engine — только при ненулевой aggregation model, tree projection runtime — при первом tree operation, formula diagnostics — при первом compute/formula call; plain rows path сохраняется, dynamic import и public API не вводились.
- **Tree-shaken fixture slice:** benchmark теперь дополнительно собирает minified esbuild bundles; текущий Node 22 run дал core plain/advanced `636,153/528,042` bytes, Vue plain/advanced `548,711/540,533`, Vue app `1,398,693`, pivot `11,091`, worker `363,297`. Эти числа являются consumer bundle baseline и не являются browser parse/paint measurement.
- **DoD:** artifact показывает состав и стоимость documented capability entrypoints и повторяемый startup baseline; добавлены `docs/perf/datagrid-package-footprint-baseline.json` и `bench:datagrid:package-footprint:assert` с явными growth budgets. Measurement sub-slice выполнен: `bench:datagrid:runtime-lifecycle` фиксирует factory-to-ready/create-dispose для plain, sorted-filtered и advanced consumer fixtures, baseline хранится в `docs/perf/datagrid-runtime-lifecycle-baseline.json`. Lazy slots для histogram, pivot, aggregation, tree projection, formula diagnostics и computed registry реализованы и покрыты focused contracts; plain/sorted/advanced lifecycle run после изменения: create p50 `8.08/12.82/12.23ms`, dispose p95 `0.02/0.02/0.01ms`. Это подтверждает отсутствие eager registry initialization в plain path, но не является доказательством browser startup win; browser parse/paint/heap evidence и consumer-specific bundle comparison остаются открытыми. Не использовать число строк в factory как proxy runtime cost.
- **Риск:** import cycles, startup-order changes, публичная совместимость и нарушение формульных/compute invariants. **Public API:** модульная регистрация/новые entrypoints требуют предложения и согласования. Размер: A — S/M, B — L и не автоматическое продолжение.

### HP-16. Удобный app input провоцирует полный rebuild

- **Код:** `datagrid-vue-app/src/useDataGridAppRowModel.ts:102` при новой ссылке `rows` вызывает `setRows`; `:89` пересоздаёт модель при изменении options и увеличивает instance key, options watcher — deep. `core/models/mutation/clientRowRowsMutationsRuntime.ts:89` нормализует все rows; `state/clientRowSourceNormalizationRuntime.ts:45` проходит весь массив и клонирует верхний уровень row data через property descriptors.
- **Сценарий:** обычный immutable Vue parent обновляет один record через новый массив либо пересоздаёт inline options. Пользователь получает O(N) ingest/возможный remount вместо быстрого patch, хотя core умеет точечные изменения.
- **Исправление A:** выполнено в integration guide: production-shaped recipe стабильной модели + `patchRows`, стабильные options и явное разделение full replacement versus high-frequency workflow.
- **Исправление B:** выполнен opt-in contract: app row-model пропускает recreate для эквивалентных inline options и в режиме `rowsUpdateMode="patch"` переводит same-length immutable record updates со стабильными IDs в `patchRows`. Add/remove/reorder, row-node и primitive inputs сохраняют replace path; default остаётся `replace`.
- **DoD:** integration guide обновлён; focused options/diff contract теперь проверяет сохранение owned model и identity неизменённых row nodes; `bench:datagrid:app-inputs` на 100k rows / 100 updates показал stable `patchRows` p95 `0.041ms` против immutable `setRows` p95 `104.754ms`. Editor/selection, allocations и model disposal остаются browser workload validation.
- **Риск:** неверная идентичность строк, потеря focus/history при remount. **Public API:** documentation slice независим, новые input modes согласовать. Зависимости: HP-02 для projected workload. Размер: A — S, B — M.

## 5. Дополнительные риски, не выдаваемые за подтверждённые bottlenecks

- **Pointer preview:** orchestration `useDataGridGlobalPointerLifecycle.ts:57` имеет default `sync`; `raf` режим и тесты уже есть. Под 500–1000 Hz input измерить число preview commits/frame, latency selection/fill/resize, затем выбирать режим. Без measurement не переводить все gestures в rAF: timing — часть поведения.
- **Canvas chrome / DOM measurements:** `useDataGridStageChromeCanvas.ts:411` и `useDataGridStageChromeModel.ts:92` читают layout. Наличие `getBoundingClientRect` само по себе не доказывает layout thrashing. Нужен browser trace с call stacks, invalidations и source redraw labels; обычный scroll уже имеет selective redraw paths.
- **Column histogram:** `clientRowColumnHistogramRuntime.ts:50` при `ignoreSelfFilter` заново строит выбранные rows, затем histogram. Повторные одинаковые открытия меню теперь используют bounded LRU на 32 результата; cache key включает model revisions, scope, search, limit, order и style. Contract проверяет invalidation после смены revision. Benchmark на 100k rows / 256 distinct values: cached query `4,034,227.81 ops/s`, cold high-cardinality query `106.18 ops/s` (`37,995.05x` в этом Node run). Deferred menu launch не делает cold synchronous histogram interruptible; cancellation и browser cold-open trace остаются отдельной проверкой.
- **Memory soak:** `scripts/bench-datagrid-soak-session.mjs:424` моделирует renderer cache через Map; это полезный model-soak, не mounted Vue/DOM leak test. Нужен отдельный browser remount/edit/overlay/worker soak с retained heap, detached nodes, listeners и worker teardown.
- **Telemetry:** `useDataGridAppViewport.ts:22` ограничивает perf store 400 samples; burst per-cell samples может вытеснять другие scopes. Перед сравнением проверить sampling completeness и влияние `dgPerfTrace`/MutationObserver на измерения; throughput без instrumentation и attribution run хранить отдельно.
- **Public behavior matrix:** реальный screen reader, iPad Safari, Android Chrome, Firefox/WebKit, 120 Hz, fractional zoom, RTL и mixed enterprise features в этой сессии не проверены. Заявления о полной поддержке потребуют отдельных acceptance runs.
- **Документы расходятся:** virtualization support matrix всё ещё отмечает server-delegated clipboard как planned и 10k-column browser/churn coverage как отсутствующее, хотя актуальные `server-datasource/selection-operations.md`, adapter `executeOperation` и benchmark harness показывают уже реализованные части. При создании задач не открывать их повторно как «написать с нуля»; сверять актуальный код. Фактический backend handler и его latency — отдельное доказательство.

## 6. Выполненная валидация и измерения

### Автоматические проверки текущего исходного кода

| Проверка | Результат |
| --- | --- |
| `node scripts/check-datagrid-perf-contracts.mjs` | 61/61 checks; 10/10 по собственной статической шкале |
| `node scripts/check-datagrid-architecture-acceptance.mjs` | 63/63 checks; 10/10 по собственной статической шкале |
| `node scripts/check-datagrid-docs-framework-track.mjs` | 0 violations; 3 files checked, 10 skipped |
| Core: virtualization range + horizontal stress + client row model stress | 3 files, 12 tests passed |
| Vue: app viewport + row-height metrics contracts | 2 files, 48 tests passed |
| Core: range cache | 1 file, 8 tests passed |
| Worker-owned row model | 1 file, 15 tests passed |
| Vue app: table stage contracts | 1 file, 90 tests passed |
| `pnpm --filter @affino/datagrid-core run build` | passed: public TypeScript build + ESM specifiers |

Итого: **8 test files, 173 tests passed**. Статические 10/10 — проверка собственных правил (в том числе наличия файлов/токенов), а не оценка производительности или архитектурного превосходства. Полная suite и browser e2e не запускались; это не «весь проект зелёный».

Команды focused suites:

```sh
pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/viewport/__tests__/virtualizationRangeInvariants.contract.spec.ts src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts src/models/__tests__/clientRowModel.stress.spec.ts
pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppViewport.contract.spec.ts src/app/__tests__/dataGridRowHeightMetrics.contract.spec.ts
pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/models/__tests__/rangeCache.spec.ts
pnpm --filter @affino/datagrid-worker exec vitest run --config vitest.config.ts src/__tests__/workerOwnedRowModel.spec.ts
pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts
```

### Свежий существующий row-model benchmark

```sh
BENCH_SEEDS=1337,7331,2026 BENCH_WARMUP_RUNS=1 BENCH_OUTPUT_JSON=/tmp/datagrid-audit-2026-09-07-rowmodels.json node --expose-gc ./scripts/bench-datagrid-rowmodels.mjs
```

| Сценарий | Размер | p95 по отдельным seeds, ms |
| --- | --- | --- |
| Client range | 120k rows, range 120 | 0,005 / 0,004 / 0,006 |
| Synthetic server range | 240k logical rows, range 180 | 0,528 / 0,426 / 0,553 |
| Window-shift proxy | 1M logical, materialized window 1600 | 1,491 / 1,242 / 1,370 |

Mean elapsed per seed: 3544,29 ms. Это **observation run без заданных finite assert budgets**, а не новый CI performance pass. Window-shift proxy не отображает миллион DOM rows; synthetic server не доказывает HTTP/SQL latency. `/tmp` JSON — временный локальный артефакт; существенные результаты сохранены в этом документе.

### Свежий probe стоимости patch

Условия: payload `{id,value,note}`, одна patch-строка в середине; 5 warmup + 30 measured операций на режим; p50 = samples[14], p95 = samples[28] отсортированного набора. GC перед созданием каждой модели; baseline sort и ingestion вне timed region. Режимы выполнялись последовательно, порядок не рандомизирован; это diagnostic probe, не статистический сравнительный benchmark.

| N | Flat p50 / p95, ms | Sorted, unrelated field p50 / p95, ms | Sorted key + recomputeSort p50 / p95, ms |
| --- | --- | --- | --- |
| 10k | 0,0045 / 0,0647 | 1,8013 / 2,6634 | 0,9529 / 1,5296 |
| 100k | 0,0035 / 0,0036 | 23,9709 / 42,2167 | 14,2488 / 20,1454 |
| 300k | 0,0035 / 0,0038 | 84,7371 / 213,5699 | 55,4699 / 94,2590 |

Key-update здесь быстро становится почти отсортированным workload: эти числа не доказывают, что пересортировать произвольные данные дешевле frozen patch. Значимы сам разрыв flat/projected и рост с N. p99 на 30 samples не заявляется.

Воспроизводимый probe из корня после core build:

```sh
node --expose-gc --input-type=module <<'JS'
import { createClientRowModel } from './packages/datagrid-core/dist/src/index.js';
import { performance } from 'node:perf_hooks';
for (const n of [10000,100000,300000]) {
  for (const mode of ['flat','sorted-unrelated','sorted-key']) {
    global.gc();
    const model = createClientRowModel({
      rows: Array.from({length:n}, (_,id) => ({id,value:id,note:0})),
      resolveRowId: row => row.id,
    });
    if (mode !== 'flat') model.setSortModel([{key:'value',direction:'asc'}]);
    const samples = [];
    for (let k=0; k<35; k++) {
      const t = performance.now();
      model.patchRows([{rowId:Math.floor(n/2), data:mode==='sorted-key'
        ? {value:n+k} : {note:k+1}}], mode==='sorted-key' ? {recomputeSort:true} : {});
      const elapsed = performance.now()-t;
      if (k>=5) samples.push(elapsed);
    }
    samples.sort((a,b)=>a-b);
    console.log({n,mode,p50:samples[14],p95:samples[28],max:samples[29]});
    model.dispose();
  }
}
JS
```

### Воспроизведение tree failure

```sh
node --expose-gc --input-type=module <<'JS'
import { createClientRowModel } from './packages/datagrid-core/dist/src/index.js';
for (const n of [10000,150000]) {
  const model = createClientRowModel({
    rows: Array.from({length:n}, (_,id)=>({id,path:['root']})),
    resolveRowId: row=>row.id,
    initialTreeData: {mode:'path',getDataPath:row=>row.path,expandedByDefault:true},
  });
  const key = model.getRow(0)?.groupMeta?.groupKey;
  try {
    model.collapseGroup(key);
    const collapsed = model.getRowCount();
    model.expandGroup(key);
    console.log({n,collapsed,expanded:model.getRowCount(),ok:true});
  } catch (error) {
    console.log({n,error:error.name,message:error.message,stack:error.stack});
  }
  model.dispose(); global.gc();
}
JS
```

Результат: 10k → 1 → 10001 rows, success; 150k → `RangeError` в compiled `treeProjectionRuntime.js:1012`, соответствующий source `treeProjectionRuntime.ts:1446`. Probe ловит исключение для диагностики и поэтому сам завершился exit 0; это **не успешный тест дерева**.

### Исторические browser artifacts — только как сигнал риска

`artifacts/performance/bench-datagrid-enterprise-browser-frames.assert.json`, generatedAt `2026-05-20T17:44:34.253Z`, 100k rows, 32 columns, 2 sessions, `ok:true`:

| Сценарий | `aggregate.frameMs.p95`, ms | `aggregate.fps.p50` |
| --- | --- | --- |
| slow custom renderers | 83,3 | 15,28 |
| wide pinned horizontal | 66,8 | 19,81 |
| auto-height custom renderers | 100,0 | 11,97 |
| overlay-heavy selection/fill | 100,0 | 13,84 |

Touch artifact от 2026-05-17 одновременно содержит smooth vertical около 60 FPS и jump vertical около 32 FPS. Это показывает, почему нельзя заменять весь профиль одним smooth-scroll числом. Текущие материалы `docs/perf/datagrid-browser-performance-next-slices.md` описывают последующие оптимизации; их нельзя ни игнорировать, ни считать свежим trace этой сессии.

## 7. Как доказать «не хуже» и где можно пытаться выиграть

### Матрица честного сравнения

| Workload | Параметры | Обязательные метрики |
| --- | --- | --- |
| Cold mount / ready | 10k/100k client rows; plain/formatter/Vue renderer | data-ready→first correct paint, main-thread blocking, peak heap, DOM cells |
| Smooth/fast/jump scroll | 100k/1M logical rows; 32 columns; pinned L/R | frame intervals p50/p95/p99, input→correct paint, blank pixels/duration, pane drift |
| Wide grid | 1k/10k columns; hidden/reorder/pinning | mounted cells, horizontal frame tails, initial width=0, resize latency |
| Streaming update | 1/100/1000 patches; 10/100 batches/s | update→paint, model time, GC/allocations, backlog, correctness |
| Projection update | sorted/filter/group/pivot + unrelated/relevant fields | visited rows, dirty stages, latency, rank/membership/aggregate correctness |
| Tree | broad/deep/skewed; branch near start/end | expand/collapse latency, allocations, maximum branch width without failure |
| Pivot | high/low cardinality, sparse/dense, subtotals | build/patch latency, output size, peak/retained heap, rejection behavior |
| Variable heights | fixed/sparse/dense autosize; width changes | height update cost, anchor drift, inverse-coordinate correctness |
| Server/worker | controlled RTT 20/100/300ms; stale/error/overload | loaded viewport availability, request count/bytes, cancellation, backlog, cache reuse |
| Interaction | editor + scroll; range/fill + pinned panes | editor focus, selection continuity, input latency, per-frame work |
| Long session | 30–60min mounted app; repeated create/dispose | retained heap slope/plateau, detached nodes/listeners, worker cleanup |

Для server tests обе таблицы получают одинаковый backend/data generator и одинаковую latency policy. Для AG high-frequency сравнивать одинаковую batch policy: официально `applyTransactionAsync` по умолчанию накапливает обновления 50 ms. Одинаковый throughput при разной задержке не означает одинаковый UX. [High Frequency Updates](https://www.ag-grid.com/javascript-data-grid/data-update-high-frequency/).

### Предлагаемые критерии, пока не действующие SLA

- Зафиксировать поддерживаемый профиль: browser/OS/device, viewport, renderer class, rows/columns, model mode, update rate. Универсальное «быстрее на любых данных» не является проверяемой целью.
- Неухудшение: верхняя граница выбранного confidence interval для отношения latency Affino/AG <=1,10 на критических сценариях, без ухудшения correctness, blank viewport и memory caps. 10% — предлагаемая tolerance, подлежит согласованию.
- Превосходство: подтверждённый воспроизводимый выигрыш хотя бы 20% в заранее выбранных приоритетных workloads плюс отсутствие существенных регрессий в остальных. 20% — целевой критерий, не обнаруженный результат.
- Минимум несколько независимых сессий и чередование порядка продуктов; warmup отдельно. Количество samples достаточно для заявленного percentile; p99 не выводить из горстки operations. Хранить не только средние, но и worst session/raw data.
- Для smooth-scroll latency не путать 16,7 ms cadence экрана 60 Hz с 16,7 ms бюджетом JS: часть кадра нужна браузеру на layout/paint/compositing. Для 120 Hz нужен отдельный профиль.
- Недоступные возможности сравнивать как feature gaps, а не исключать молча из знаменателя. Enterprise parity также включает editor/clipboard/server semantics, a11y, export/state compatibility; этот аудит не закрывает их полностью.

Возможные области будущего преимущества Affino: очень дешёвый flat patch, явные row-model/projection boundaries, headless integration, worker-owned workloads, узко оптимизированные Vue flows. Это направления для проверки, не доказанные уникальные возможности: наличие formulas, tree, pivot или workers само по себе не означает превосходство над актуальным конкурентом.

## 8. Порядок закрытия и требования к будущим промптам

### Очередь

1. **Немедленно:** HP-01; HP-03; HP-02/A. Независимые узкие изменения, отдельные commits.
2. **Следующая волна:** HP-04 comparator fixture; HP-06/A zero-width window; HP-12/A worker terminal errors; HP-08/A cardinality guard.
3. **По trace и целевым клиентам:** HP-07, HP-10, HP-11, HP-13/A, HP-14; HP-16/A integration recipe можно делать независимо.
4. **Архитектурные решения:** HP-09 по одной оси, затем HP-05; HP-15 сначала measurement-only. HP-13/B hierarchical stores и HP-08/B sparse pivot — отдельные design proposals, не общая «оптимизация таблицы».

### Шаблон входных данных для генератора промптов

Для каждой задачи передавать: **ID → trigger → подтверждённые пути → текущее поведение → требуемый результат → invariants → допустимые пакеты → API approval flag → focused validation → perf acceptance → docs update → зависимости**.

Обязательные ограничения будущим исполнителям:

- Сначала сверить указанные symbols с текущим commit: номера строк в этом документе относятся к аудируемой ревизии.
- Не считать findings уже исправленными и не закрывать задачу существованием документа/теста без нужного сценария.
- Не понижать workloads, не расширять budgets, не отключать renderer/feature ради прохождения проверки.
- Не менять public API/default behavior без отдельного согласованного предложения.
- Не вводить новые managers/controllers, если можно расширить существующего владельца; не объединять runtime math с Vue lifecycle.
- Сохранять desktop/touch, pinned panes, selection, editor, history и stale-result semantics в затронутых путях.
- Для perf fix предъявить before/after на одной среде и correctness oracle; для measurement gap — показать, что проверка действительно падает при нарушении инварианта.
- Для browser-visible slices обязательна проверка blank gaps, pinned synchronization, focus, overlays, scroll anchor и соответствующего pointer/touch workflow.
- Документы обновлять в том же slice; устаревшие planned items сверять с текущей реализацией. Большие потенциальные переписывания сначала оформлять как решение с измеренным основанием.

Не формировать один промпт «сделать лучше AG Grid». Этот документ предназначен для серии конкретных задач с измеримым завершением.

## 9. Источники

Локальные опорные материалы: `docs/datagrid-architecture.md`, `docs/datagrid-troubleshooting-runbook.md`, `docs/datagrid-strict-contract-testing.md`, `docs/datagrid-viewport-controller-decomposition.md`, `docs/datagrid-viewport-math-engine.md`, `docs/perf/datagrid-performance-gates.md`, `docs/perf/datagrid-browser-performance-next-slices.md`, `docs/datagrid-virtualization-support-matrix.md`, `docs/server-datasource/integration-docs-map.md`, `docs/server-datasource/selection-operations.md`. Старые аудиты использовались как контекст, а не как доказательство отсутствия уже реализованных функций.

Внешние первичные источники, проверенные 2026-09-07: официальные страницы AG Grid [Scrolling Performance](https://www.ag-grid.com/javascript-data-grid/scrolling-performance/), [Massive Row Count](https://www.ag-grid.com/javascript-data-grid/massive-row-count/), [High Frequency Updates](https://www.ag-grid.com/javascript-data-grid/data-update-high-frequency/), [SSRM Configuration](https://www.ag-grid.com/javascript-data-grid/server-side-model-configuration/). Сведения о конкуренте ограничены описанными там механизмами; сравнительные performance numbers не заимствовались и не изобретались.
