# Строгий аудит DataGrid: производительность, архитектура и сравнение с AG Grid Enterprise

Дата: 2026-09-07. Проверенный commit: `9c79456d86c58d5c1c37e925239c08328a84f67a`.
Статус: аудит завершён; перечисленные ниже изменения **не реализованы**.
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
- **Исправление:** заменить spread insertion на безопасную сборку/перенос диапазона с ограниченным числом аргументов. Сначала узкий fix; смена структуры всего дерева не обязательна.
- **DoD:** collapse/re-expand одной ветки 150k и 300k; path и parent tree; порядок, rowId, aggregates, display indexes, snapshot/expansion consistency после операции. Добавить benchmark ширины ветки, а не только общего числа строк или глубины.
- **Риск:** частично изменённые expansion/cache state при исключении; тестировать повторную команду после ошибки. Аналогичный класс spread insertion есть в `clientRowRowsMutationsRuntime.ts:116` (`...moved`); это отдельный кандидат на проверку, его отказ здесь не воспроизводился.
- **Public API:** изменение не требуется. Зависимости: нет. Размер: S.

### HP-02. Быстрый patch заканчивается при включении сортировки

- **Код:** `models/host/clientRowPatchHostRuntime.ts:100` исключает fast path при sort/filter/group/tree/pivot/aggregation/pagination. Далее `models/projection/clientRowProjectionBasicStages.ts:58` вызывает `remapRowsByIdentity` и создаёт `new Set(previousFilteredRowIds)` даже без пересчёта фильтра. `models/clientRowRuntimeUtils.ts:63` строит массив при обходе всей входной проекции; `preserveRowOrder` с `:83` строит дополнительные индексы и наборы.
- **Сценарий:** streaming updates либо editing одной ячейки при активной сортировке; изменяемое поле не связано с сортировкой. Замораживание порядка не устраняет стоимость обновления представления.
- **Свежий probe:** на 100k — 23,97 ms p50 / 42,22 ms p95; на 300k — 84,74 / 213,57 ms. Исходные строки уже загружены, сортировка уже применена, DOM отсутствует. Это подтверждённый bottleneck модели, а не предположение о Vue.
- **Исправление A:** передавать changed row IDs/next rows по существующим проекциям; обновлять затронутые позиции без remap всего набора там, где membership/order не изменяются. Сохранять identity и frozen semantics.
- **Исправление B:** отдельно оценить пакетирование потоковых patch и обновление sort/filter membership для действительно затронутых ключей. Не подменять A добавлением debounce: одиночная операция останется дорогой.
- **DoD:** 10k/100k/300k, 1/100/1000 changed rows, sorted-unrelated, sorted-key, filtered-hidden, grouping/aggregation, pagination. Проверять allocations, число посещённых строк, notifications и итоговые значения, а не только stage `recomputed=false`. Для unrelated patch с фиксированным K не должно быть обязательного полного прохода по N; целевой p95 согласовать после калибровки runner.
- **Риск:** stale row references, нарушение порядка/frozen policy, некорректные агрегаты и computed fields. Сравнивать с полным recompute как correctness oracle.
- **Public API:** A — не требуется; B — сначала проверить существующие batch/transaction возможности. Новый публичный scheduling API требует отдельного предложения и согласования. Зависимости: измерения HP-03, но A можно начать сразу. Размер: M–L.

### HP-03. Performance gate может быть зелёным при плохом UX

- **Код:** `scripts/bench-datagrid-harness.mjs:307` — CI browser task: 1 session, frame p95 180 ms, dropped-frame 100%, viewport-update p95 180 ms, CV 180%, renderer p95 8 ms **на callback**, до 30 000 cell mounts на scroll write.
- `BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS` в этом профиле не включён; значение по умолчанию в `bench-datagrid-enterprise-browser-frames.mjs:111` — `false`. В `.github/workflows/ci.yml` benchmark job вызывает именно `bench:regression`. Отдельные строгие npm scripts существуют, но их существование не означает выполнение тем же CI job.
- **Факт H:** файл `artifacts/performance/bench-datagrid-enterprise-browser-frames.assert.json`, 2026-05-20: `ok=true`, тяжёлые renderers 83,3 ms frame p95 и 15,28 FPS. Это объяснимо записанными бюджетами, а не доказывает сломанный JSON.
- **Разрыв:** `docs/perf/datagrid-performance-gates.md` заявляет scroll latency <=16 ms и CV<=25%; фактические профили гораздо мягче. Время функции, frame interval и input-to-paint — разные величины, заменять одну другой нельзя.
- **Исправление:** отделить correctness/smoke ceilings от UX-SLO profiles; критичные resource warnings сделать blocking в фактической цепочке CI; budgets по сценариям, минимальный sample count, явный fail при нулевых samples, raw samples и environment metadata. Не ужесточать пороги вслепую на shared runner.
- **DoD:** искусственное нарушение каждого frame/resource бюджета делает CI красным; soft observation явно обозначен. Для smooth scroll отдельные 60/120 Hz профили; teleport stress отдельно. Проверять совокупное renderer time за frame, а не только p95 одного дешёвого callback.
- **Дополнительный дефект интерпретации:** `droppedFramePct` в script `:675` — доля наблюдённых интервалов >20 ms. Это не число потерянных refresh opportunities и плохо переносится на 120 Hz. Переименовать/документировать либо добавить refresh-aware метрику, сохранив совместимость artifacts.
- **Public API:** не требуется; artifact schema может требовать миграции consumers. Зависимости: нет. Размер: M.

### HP-04. Сравнительного стенда AG Grid не обнаружено

- **Область поиска:** scripts, e2e, CI, perf docs, manifests sandbox/showcase. Есть AG-target названия и собственные before/after сравнения; реализация запуска AG Grid в проверенной области не найдена.
- **Последствие:** невозможно сказать, быстрее ли Affino на том же workload, где граница памяти и сколько стоит flexibility. «Enterprise» в имени теста не является сравнением.
- **Исправление:** минимальный отдельный comparator fixture с точной версией AG Grid Enterprise/Vue wrapper и общим генератором данных. Не примешивать dependency конкурента в production packages.
- **DoD:** матрица из раздела 7; одинаковая модель данных, колонки, formatter/renderer complexity, row height, pinned panes, viewport, сортировка и batch latency; production builds. Raw artifacts, commit/version, browser, CPU profile, warmup и порядок прогонов фиксируются. AG Enterprise запускается с корректно предоставленной конфигурацией лицензии.
- **Риск:** сравнить холодный Affino с прогретым AG, plain cells с Vue components, local rows с серверной загрузкой либо batch с per-row update и получить ложную победу.
- **Public API:** не требуется. Зависимости: HP-03. Размер: M, затем расширение матрицы.

### HP-05. Большое число логических строк упирается в физическую высоту DOM

- **Код:** `datagrid-vue-app/src/stage/DataGridTableStage.vue:630` задаёт высоту body из `resolveRowOffset(totalRows)` либо `totalRows * baseRowHeight`; `datagrid-vue/src/app/useDataGridAppViewport.ts:1072` преобразует native scrollTop непосредственно в row index. В проверенных core/app путях не обнаружен отдельный mapping logical offset ↔ ограниченный physical scroll extent.
- **Сценарий:** 1M × 100 px = 100M px; server datasource с миллионами строк не решает ограничения DOM сам по себе. Даже при нескольких десятках mounted rows scrollbar требует представимого extent.
- **Статус:** архитектурный риск C/V; конкретная граница и недоступность последней строки в текущем браузере здесь не измерялись. Нельзя заявлять, что 1M строк всегда ломается: при иной высоте и браузере результат другой.
- **Ориентир:** AG Grid документирует измерение browser max height и stretching. Число 32M px на их странице относится к приведённому примеру Chrome, а не является универсальной константой. [Официальное описание](https://www.ag-grid.com/javascript-data-grid/massive-row-count/).
- **Исправление:** сначала browser test last-row reachability, затем bounded physical scroll + logical mapping в core math при подтверждении лимита. Через тот же mapping должны идти selection, programmatic scroll, overlays и pinned rows.
- **DoD:** 1M/10M logical server rows; 24/31/100 px и variable heights; top/middle/last row, thumb drag, keyboard End, scrollToCell, restoration, fractional zoom. Бounded DOM, отсутствие blank gaps и корректные абсолютные индексы.
- **Public API:** сначала внутренний mapping; любые новые публичные координаты согласовать. Зависимости: HP-09. Размер: L.

### HP-06. Wide-grid default и zero-size materialization

- **Код:** `datagrid-vue-app/src/config/dataGridVirtualization.ts:29` задаёт `columns:false`; `true` включает обе оси. `datagrid-vue/src/app/useDataGridAppViewport.ts:970` при `availableWidth<=0` возвращает все колонки даже при включённой column virtualization.
- **Стоимость:** O(renderedRows × allColumns), а не O(renderedRows × visibleColumns). На скрытой вкладке/нулевой начальной ширине возможен дорогой первый render до измерения viewport. Это C, не измеренный в браузере mount spike.
- **Исправление A:** ограниченный zero-size bootstrap window или ожидание валидного measurement с определённым first-paint contract.
- **Исправление B:** понятный wide-grid preset/explicit documented setting; изменение default не проводить молча.
- **DoD:** 32/1k/10k колонок, первоначальный width=0 → visible, hide/show container, resize, pin/unpin, reorder. Число mounted cells ограничено окном; header/overlay/scrollToColumn согласованы. Контроль `virtualization:false` сохраняет ожидаемую семантику.
- **Риск:** initial flash, некорректный autosize скрытых колонок, breaking change default. **Public API/behavior:** для B сначала предложение и согласование. Размер: A — S/M, B — отдельный slice.

### HP-07. Authored renderers могут блокировать каждый render window

- **Код:** `stage/useDataGridStageCellRendering.ts:133` синхронно вызывает renderer; `DataGridTableStageCenterPane.vue:187` вычисляет content при render. Error fallback есть, автоматического переноса тяжёлого renderer после scroll в проверенном пути нет.
- **Последствие:** bound по числу DOM cells не даёт bound по стоимости пользовательского callback. Даже сотни callbacks по долям миллисекунды могут исчерпать frame budget. Исторические тяжёлые сценарии из раздела 6 подтверждают необходимость отдельного профиля, но не дают актуальный FPS.
- **Исправление:** измерить обычные spans, Vue components, interactive renderers, formatter-only и deliberately slow renderer; затем opt-in defer/placeholder policy для тяжёлого content и ограничение совокупной работы за frame. Сохранить уже сделанные shell pooling/native-text оптимизации.
- **Ориентир:** у AG Grid есть `deferRender` для тяжёлых cell components и skeleton до окончания scroll. [Scrolling performance](https://www.ag-grid.com/javascript-data-grid/scrolling-performance/).
- **DoD:** улучшение input-to-paint и frame tail с сохранением stateful row identity, editor focus, custom events, group renderer semantics, a11y; после остановки скролла окончательный content появляется в ограниченное время. Stateful children нельзя безусловно переиспользовать по viewport slot.
- **Public API:** новый renderer policy сначала предложить и согласовать. Зависимости: HP-03. Размер: M.

### HP-08. Pivot материализует плотную матрицу

- **Код:** `datagrid-core/src/models/pivot/pivotRuntime.ts:555` в `buildPivotRowNode` проходит все `columnOrder` и все value columns для каждой output row, записывая даже отсутствующие значения как `null`. Публичный `DataGridPivotSpec` в `datagrid-pivot/src/contracts.ts:23` не содержит ограничения output cardinality; guard в проверенном build path не найден.
- **Стоимость:** минимум O(Rp × Cp × V) output property work, независимо от горизонтальной DOM virtualization. Rp — output rows, Cp — уникальные pivot tuples, V — value specs. Маленький source с высокой cardinality может породить огромный разреженный результат, который хранится плотно.
- **Исправление A:** оценка размера результата до dense materialization; определённый diagnostic/error/limit behavior для чрезмерного результата.
- **Исправление B:** по замерам рассмотреть sparse aggregate storage + lazy cell access, пользуясь существующими row/cell contracts. Поддержка null в exported snapshots требует отдельного решения.
- **DoD:** равномерная и skewed cardinality, sparse и dense intersections, несколько aggregations, subtotals/grand totals, value patch и axis-key patch; heap peak, build latency, export/read/drilldown correctness. Guard должен срабатывать до чрезмерных allocations.
- **Риск:** несовместимость сериализованного row payload, export, формул, сортировки и custom renderer reads. **Public API:** новые limits/lazy access согласовать. Зависимости: HP-03, для B — оценка HP-15. Размер: A — M, B — L.

### HP-09. Два места определяют геометрию viewport

- **Код:** core `virtualization/verticalVirtualizer.ts`, `viewport/dataGridViewportVirtualization.ts`, horizontal math; одновременно Vue `useDataGridAppViewport.ts:952–1130` сам вычисляет binary-search column window, row range, overscan и retention. Импортируемый core overscan controller не объединяет всю геометрию.
- **Проблема:** часть работы — законная materialization, но row/column offset-to-index и clamp formulas уже относятся к канонической геометрии. Документированный single-owner contract не полностью соответствует фактическому месту вычислений.
- **Последствие:** исправление variable heights, hidden columns, huge scroll или fractional offsets надо согласованно переносить в несколько путей. Пройденный core stress test не гарантирует такой же результат app path.
- **Исправление:** выделять/переиспользовать существующие чистые helpers по одной оси; Vue сохраняет DOM sampling, refs, scheduling и retained render window. Не переносить Vue watchers в core и не строить ещё один controller.
- **DoD:** differential/property tests одинаковых входов core/app: boundary offsets, empty data, pinned widths, hidden/reordered columns, variable heights, viewport resize; разрешённые отличия overscan/materialization явно описаны. Desktop/touch behavior сохраняется.
- **Риск:** timing changes при механическом объединении math и scheduling. **Public API:** предпочтительно внутренние helpers. Зависимости: нет; ограничивать slice одной областью. Размер: M–L.

### HP-10. Локальный tree toggle имеет глобальную стоимость

- **Код:** `treeProjectionRuntime.ts:1435`/`:1534` — `input.rows.slice()`, далее insertion и `rebuildGroupIndexByRowIdFrom`; `:1337` проходит group-index map и оставшийся хвост rows.
- **Стоимость:** O(P) копирование flattened projection и обработка хвоста даже при изменении небольшой ветки в начале. P — количество видимых логических строк, не DOM window. Исправление HP-01 само по себе это не устранит.
- **Исправление:** сравнить in-place indexed projection, chunked sequence и incremental index maintenance на реальных workloads. Не вводить rope/order-statistic tree до доказательства выигрыша и оценки стоимости random access.
- **DoD:** одинаковая маленькая ветка в начале/середине/конце 100k/300k projection; отдельно огромная ветка; collapse/expand, aggregates, focused cell и viewport anchor. Измерить allocations и latency по позиции, а не усреднять разные trees.
- **Public API:** не требуется при сохранении snapshot invariants. Зависимости: HP-01. Размер: M/L.

### HP-11. Viewport restore по rowId выполняет линейный поиск

- **Код:** `datagrid-vue/src/app/useDataGridAppViewport.ts:1141`, `resolveBodyRowIndexById`, перебирает `getBodyRowAtIndex` от 0 до total; используется в `resolveViewportPositionScrollTop`.
- **Сценарий:** восстановление сохранённого viewport около конца большого dataset. Для sparse model особенно нежелательно искать ненайденный ID перебором unloaded rows; то, вызовет ли это loads, зависит от реализации getter и требует теста.
- **Исправление:** использовать существующий rowId index/capability, а для unloaded ID — явный bounded fallback на сохранённый index либо server locate capability. Не строить новый O(N) index на каждый restore.
- **DoD:** last-row и missing-id restore на 100k/1M logical rows; число getter/pull вызовов ограничено; после sort/filter корректна выбранная identity/index policy.
- **Public API:** сначала найти внутренний доступ; новый locate API согласовать. Зависимости: HP-09 при изменении геометрии. Размер: S/M.

### HP-12. Worker: ошибки host и стоимость обмена

- **Код P1:** `datagrid-worker/src/workerOwnedRowModelHost.ts:154` вызывает `executeCommand` и затем `emitUpdate` без try/catch/error reply. Исключение в model command, getter или `postMessage` прерывает обработчик до ответа. В worker-owned proxy не обнаружено timeout/error-event завершения такого request. Обработка локального `DataCloneError` при dispatch — другой случай и не закрывает host failure.
- **Последствие:** команда может остаться без подтверждения/диагностики; для viewport запроса возможен незавершённый loading. Это C/V: браузерный worker failure в этой сессии не инжектировался. HP-01 даёт реалистичный источник model exception.
- **Исправление A:** terminal success/error result с requestId, recovery semantics, bounded pending lifecycle и обработка worker error/messageerror/termination через существующий transport contract.
- **Код P2:** каждый host command возвращает snapshot + visibleRows + aggregation/formula metadata (`workerOwnedRowModelHost.ts:123`). `postMessageTransport.ts:15` не предоставляет transfer-list в target contract. Proxy кеширует до 8 окон и дополнительно клонирует row nodes (`workerOwnedRowModel.ts:522`). Coalescing уже есть, но microtask batch не является ограничением числа команд в полёте при длительном worker compute.
- **Исправление B:** измерить bytes/message, serialization cost, ack lag, inflight work и retained heap; затем delta payload для unchanged window/metadata, viewport priority и backpressure. Transferables полезны для подходящего columnar payload, а не автоматически для любых object rows.
- **DoD:** exception, uncloneable reply, lost response, worker termination, slow worker + rapid scroll/patch bursts, stale response, dispose. Все pending states завершаются, latest requested viewport обслуживается, очередь/heap ограничены.
- **Диагностический gap:** `getSparseRowModelDiagnostics` сейчас считает `visibleRows.length + visibleWindowCache.size`, складывая строки и число окон. Это не достоверный cached-row count; исправить отдельно и проверить overlap/dedup semantics.
- **Public API:** новые transport/protocol поля и target signature сначала предложить и согласовать. Зависимости: A независим; B после HP-03. Размер: A — M, B — M/L.

### HP-13. Server cache: eviction и иерархия

- **Код:** `core/models/server/dataSourceCacheManager.ts:72` для каждого eviction снова ищет первый незащищённый index. Если все защищены, удаляет первый даже из protected ranges. `dataSourceBackedRowModel.ts:500` вызывает enforcement при каждой записи row. Отдельный `rangeCache.ts:151` тоже ищет eviction candidate проходом по chunks.
- **Стоимость/риск:** при P защищённых начальных записях и E вытеснениях поиск может приблизиться к O(P×E). Это не означает, что default 4096-row cache уже bottleneck: нужна pressure-матрица. Кеши хранят дополнительные индексы/ссылки; полного дублирования row payload этим не доказано.
- **Исправление A:** пакетное enforcement после batch insertion, ограниченный eviction search и явный contract `cacheLimit < required visible/protected range`: либо контролируемый overflow, либо документированный placeholder behavior. Измерять до изменения политики.
- **Иерархия:** datasource содержит branch/tree/pivot context, но проверенный cache keyed глобальными числовыми индексами. Отдельные root/group stores с независимым lifecycle, budgets и eviction не обнаружены. Нельзя описывать это как отсутствие серверных tree/pivot protocol fields — они есть.
- **Исправление B:** только если цель включает SSRM-level group-store reuse — проект отдельного расширения существующего datasource, со store identity и revision ownership. AG Grid описывает root cache и cache для каждого уровня grouping. [SSRM Configuration](https://www.ag-grid.com/javascript-data-grid/server-side-model-configuration/).
- **DoD:** small/large cache, visible window larger than limit, overscan, reverse scroll, slow/out-of-order replies, selective invalidation; отдельно branch collapse/reopen, соседние stores и memory caps.
- **Public API:** A по возможности внутренний; B требует согласованного протокольного предложения. Зависимости: A — HP-03 для замеров; B — отдельное архитектурное решение. Размер: A — M, B — L.

### HP-14. Переменные высоты: sparse не означает O(log N) update

- **Код:** `datagrid-vue/src/app/dataGridRowHeightMetrics.ts:164` обновляет весь suffix `chunkPrefixDeltas` после изменённого chunk; chunk size 256. Без snapshot используется полный prefix rebuild с `:219`.
- **Стоимость:** sparse single mutation O(N/256) в худшем случае; fallback rebuild O(N). Текущая chunk implementation уже существенно лучше полного rebuild, и contract tests проходят. Нельзя объявлять variable heights отсутствующими.
- **Сценарий:** dense dynamic heights, repeated autosize/resize возле начала 1M-row table, batch высот после смены ширины/renderer content.
- **Исправление:** сначала измерить sparse/dense/batched mutation; если suffix updates значимы, дерево сумм по chunks или batching version updates. Сохранить constant-height O(1) path.
- **DoD:** offsets и inverse lookup против простого prefix oracle; рост/уменьшение высоты, clear-all, skipped versions, 0/5k/dense overrides, 100k/1M logical rows. Сохранять anchor и pinned-pane row alignment.
- **Public API:** внутреннее изменение возможно; общий core/Vue geometry contract — HP-09. Размер: M. Не ставить выше HP-01/02 только из-за лучшей асимптотики.

### HP-15. Модульность и размер базового runtime ещё надо доказать

- **Код:** core зависит от formula-engine, pivot и projection-engine. `models/clientRowModel.ts:418`, `:432`, `:515`, `:838` создаёт compute/formula-related runtimes в общем composition path; stage registry фиксирован (`clientRowProjectionStageRegistry.ts:59`).
- **Вывод C/V:** физическая декомпозиция файлов/пакетов не гарантирует, что plain-grid consumer не оплачивает неподключённые возможности. Реальные bundle bytes и startup allocations здесь не измерены, поэтому «слишком большой bundle» пока не доказанный факт.
- **Исправление A:** consumer fixtures plain core / basic Vue grid / formulas / pivot / server / worker; production bundle analysis, gzip/brotli, parse/evaluate, create/dispose, retained heap; imports только из документированных entrypoints.
- **Исправление B:** лишь по результатам A — lazy initialization неиспользуемых подсистем и переиспользование существующих module/bootstrap boundaries. Для low-level kernel extraction нужен отдельный дизайн и экономическое обоснование.
- **DoD:** artifacts показывают состав и стоимость каждой capability; regression gates для базового consumer, пакетирование без внутренних source aliases, parity exports и types. Не использовать число строк в factory как proxy runtime cost.
- **Риск:** import cycles, startup-order changes, публичная совместимость и нарушение формульных/compute invariants. **Public API:** модульная регистрация/новые entrypoints требуют предложения и согласования. Размер: A — S/M, B — L и не автоматическое продолжение.

### HP-16. Удобный app input провоцирует полный rebuild

- **Код:** `datagrid-vue-app/src/useDataGridAppRowModel.ts:102` при новой ссылке `rows` вызывает `setRows`; `:89` пересоздаёт модель при изменении options и увеличивает instance key, options watcher — deep. `core/models/mutation/clientRowRowsMutationsRuntime.ts:89` нормализует все rows; `state/clientRowSourceNormalizationRuntime.ts:45` проходит весь массив и клонирует верхний уровень row data через property descriptors.
- **Сценарий:** обычный immutable Vue parent обновляет один record через новый массив либо пересоздаёт inline options. Пользователь получает O(N) ingest/возможный remount вместо быстрого patch, хотя core умеет точечные изменения.
- **Исправление A:** production-shaped recipe стабильной модели + patchRows/существующих mutation APIs, стабильные options, объяснение controlled versus high-frequency workflow; не рекомендовать deep reactive mutations dataset.
- **Исправление B:** проверить возможность обновлять реально изменяемые options без полной пересборки; diff rows — отдельный opt-in contract, а не невидимое изменение `setRows` semantics.
- **DoD:** пример 100k строк с 100 updates/s и активным editor/selection; count model recreations, ingest allocations, time-to-visible update; immutable replacement остаётся корректным. Деструкция предыдущей модели освобождает subscriptions.
- **Риск:** неверная идентичность строк, потеря focus/history при remount. **Public API:** documentation slice независим, новые input modes согласовать. Зависимости: HP-02 для projected workload. Размер: A — S, B — M.

## 5. Дополнительные риски, не выдаваемые за подтверждённые bottlenecks

- **Pointer preview:** orchestration `useDataGridGlobalPointerLifecycle.ts:57` имеет default `sync`; `raf` режим и тесты уже есть. Под 500–1000 Hz input измерить число preview commits/frame, latency selection/fill/resize, затем выбирать режим. Без measurement не переводить все gestures в rAF: timing — часть поведения.
- **Canvas chrome / DOM measurements:** `useDataGridStageChromeCanvas.ts:411` и `useDataGridStageChromeModel.ts:92` читают layout. Наличие `getBoundingClientRect` само по себе не доказывает layout thrashing. Нужен browser trace с call stacks, invalidations и source redraw labels; обычный scroll уже имеет selective redraw paths.
- **Column histogram:** `clientRowColumnHistogramRuntime.ts:50` при `ignoreSelfFilter` заново строит выбранные rows, затем histogram. Проверять cold-open, high cardinality, repeated menu opens и cancellation. Deferred menu launch не делает сам synchronous histogram interruptible.
- **Memory soak:** `scripts/bench-datagrid-soak-session.mjs:424` моделирует renderer cache через Map; это полезный model-soak, не mounted Vue/DOM leak test. Нужен отдельный browser remount/edit/overlay/worker soak с retained heap, detached nodes, listeners и worker teardown.
- **Telemetry:** `useDataGridAppViewport.ts:22` ограничивает perf store 400 samples; burst per-cell samples может вытеснять другие scopes. Перед сравнением проверить sampling completeness и влияние `dgPerfTrace`/MutationObserver на измерения; throughput без instrumentation и attribution run хранить отдельно.
- **Public behavior matrix:** реальный screen reader, iPad Safari, Android Chrome, Firefox/WebKit, 120 Hz, fractional zoom, RTL и mixed enterprise features в этой сессии не проверены. Заявления о полной поддержке потребуют отдельных acceptance runs.
- **Документы расходятся:** virtualization support matrix всё ещё отмечает server-delegated clipboard как planned и 10k-column browser/churn coverage как отсутствующее, хотя актуальные `server-datasource/selection-operations.md`, adapter `executeOperation` и benchmark harness показывают уже реализованные части. При создании задач не открывать их повторно как «написать с нуля»; сверять актуальный код. Фактический backend handler и его latency — отдельное доказательство.

## 6. Выполненная валидация и измерения

### Автоматические проверки текущего исходного кода

| Проверка | Результат |
| --- | --- |
| `node scripts/check-datagrid-perf-contracts.mjs` | 60/60 checks; 10/10 по собственной статической шкале |
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
