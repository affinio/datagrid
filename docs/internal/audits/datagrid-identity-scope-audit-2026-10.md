# Affino DataGrid: идентичность и смена области данных

Дата аудита: 2026-10-25. Первоначальный статус: **read-only аудит завершён**. Исправления выполнены отдельным follow-up ниже.

Найдено **12 подтверждённых проблем**: 11 новых воспроизведённых нарушений и один неполностью закрытый участок прежнего consistency finding #6. Самые опасные — удаление двух записей вместо одной в Vue и rollback optimistic edit в индекс другой записи после смены query. Отсутствие dataset boundary и намеренное сохранение состояния по прежнему ID не объявляются дефектами автоматически.

## Baseline и проверка достоверности

- HEAD: `79092ff0e7ba27181237c3e4db57b1186f157be0`, `fix(datagrid): release disposed caches and bound history`. На старте дерево уже содержало изменения Vue/chrome/clipboard/sandbox и исправления предыдущего overload audit, включая Core lifecycle/optimistic queue, orchestration batcher, worker и poller. Выводы относятся к этому рабочему дереву, не к чистому HEAD.
- Среда: Node `24.21.0`, pnpm `10.30.3`, Linux aarch64; Vitest `4.0.18`. Подготовка началась 2026-10-24, завершение — 2026-10-25 после прерывания.
- Прочитаны consistency, exception-safety и incremental compute/projection audits с таблицами закрытия, текущий overload follow-up, row/selection/view/state/history/persistence contracts. Проверены текущие реализации source replacement/cache pruning, cell resolver, atomic column replacement, pivot base-schema sync и stale-response guards.
- **25 новых сценариев passed**: 22 Core/orchestration/workbook + 3 настоящего Vue-компонента в jsdom. Из них 13 `DIAGNOSTIC ONLY` assertions воспроизводят неправильное поведение; два cache-key reproductions имеют одну причину, поэтому findings — 12. Зелёный diagnostic test не означает корректность продукта.
- **7 существующих suites / 174 теста passed**: Core API, failure recovery, incremental equivalence, orchestration runtime, Vue inline editing и row selection, workbook. Их прохождение подтверждает проверенные прежние fixes, но не опровергает новые edge cases.
- Продуктовые файлы не менялись. SHA256 tracked package diff до и после: `5d36f28aa0e7bfe883d1745f142280b8ee0764def8a9b444ec754850cc983bb2`. Полное дерево на момент фиксации, hashes владельцев и raw observations — [JSON](./202610/datagrid-identity-results.json). Добавлены только audit docs/scripts.
- [Harness и команды](../../../scripts/audits/datagrid-identity/README.md). Нет случайных seed; точные datasets/операции зафиксированы в тестах. Async-порядок проверяется deferred Promise, без sleep. Настоящий браузер в этом аудите не запускался; Vue integration — jsdom, не visual/browser certification.

## Follow-up исправлений — 2026-10-25

Все 12 подтверждённых findings закрыты в коде и сохранены как обычные regression assertions в audit harness. Новые strict checks: 26 сценариев passed (23 headless Core/orchestration/workbook + 3 Vue component в jsdom). Findings по областям:

| Findings | Исправление |
| --- | --- |
| I01 | Vue structural delete теперь передаёт typed `rowId` через DOM row-index menu и использует typed selected IDs при удалении. |
| I02 | Optimistic rollback адресует текущую query cache entry по `rowId`; устаревшую cache entry инвалидирует и загружает актуальный viewport вместо записи в старый `sourceIndex`. |
| I03 | Projection diagnostics получили отдельный `identityVersion`: он меняется после фактического пересчёта или при структурной смене ordered row IDs без пересчёта. Selection freshness не трактует viewport-only refresh как изменение identity. |
| I04 | Strict partial restore отклоняет cell selection, если saved row targets не совпадают с текущей projection. Non-strict restore сохраняет исходные revisions, поэтому selection остаётся stale; оно не рестампуется current. |
| I05, I11 | Group-value cache keys используют typed, length-prefixed row/field tuple; edit store теперь nested typed-ID/column-key maps. |
| I06 | Tree-parent expansion keys включают тип и длину ID. Уникальные legacy keys продолжают работать; неоднозначный legacy key для `1`/`"1"` не приписывается произвольно. |
| I07 | Generated group row IDs разрешают коллизии с source и предыдущими generated IDs детерминированным уникальным ID, сохраняя `groupKey` отдельно. |
| I08 | Authored/generated pivot column key collision явно отклоняется; runtime откатывает projection к последней успешной pivot-конфигурации, чтобы model и columns оставались согласованы. |
| I09 | Sort equality/cache signature кодирует descriptors как JSON tuples с однозначной границей и нормализованным набором dependency fields. |
| I10 | Base-column signature учитывает identity getter/setter callbacks и использует однозначную сериализацию структуры. |
| I12 | Group metadata snapshots сохраняют `DataGridRowId` как `string | number` в Set/Map без stringify. |

Повторная валидация follow-up: identity harness — 26/26; Core API и datasource optimistic suites — 167/167; orchestration runtime — 10/10; Vue mixed-placeholder delete regression — passed; Core, orchestration и Vue type checks — passed. Полный Vue `DataGrid.contract.spec.ts` — 224/225: оставшийся тест `highlights every row index and column header intersected by a cell range` падает в header highlighting. `DataGridTableStageHeader.vue` уже имел незакоммиченные изменения до этого follow-up; тест относится к ним/текущей интеграции и не является одним из identity findings. Полный browser/production пакетный прогон не выполнялся. Вывод о dataset/history lifetime не менялся: это незаданные политики, а не подтверждённые дефекты.

## Области идентичности

| Идентичность | Фактический контракт и область | Свидетельство / ограничение |
| --- | --- | --- |
| Source `rowId` | `string | number`, уникален в source конкретного row model. Стабилен между sort/filter/viewport и обычными refresh той же записи. `1` и `"1"` — разные допустимые ID. | Source normalization, typed `Map<DataGridRowId,...>`, duplicate checks в [rows mutation](../../../packages/datagrid-core/src/models/mutation/clientRowRowsMutationsRuntime.ts#L95). Отдельные модели с ID 42 изолированы. Нет глобального registry и нет автоматического различения двух datasets внутри одного model instance. |
| Источник datasource | Конкретный `dataSource` принадлежит созданной модели; setter смены datasource у этой модели отсутствует. Изменение захваченной host callback переменной не сообщает Core о новом dataset. | [Model](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts). Query меняет представление того же источника; write по стабильному ID остаётся принятой бизнес-операцией. |
| `datasetVersion` | Внешний version token таблицы, возвращаемый pull/mutation/push; не имя dataset, не tenant ID и не уникальный discriminator двух таблиц. | [Протокол](../../server-datasource/reference/protocol.md), [mutation version handling](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L1369). Одинаковая версия двух источников сама по себе не означает одну область. |
| Pull query identity | Внутренний serializable state key: sort/filter/group/expansion/pivot/aggregation/pagination/cursor; request key также включает range/reason/priority/tree context. Active requestId и AbortSignal защищают применение результата. | [Request identity](../../../packages/datagrid-core/src/models/server/dataSourceRequestIdentity.ts#L9), [response guard](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L1166). Это не новый публичный dataset ID. |
| Selection `queryRevision` | Локальная projection identity, а не серверный query token. Она использует `projection.recomputeVersion`, затем version/revision fallback; all-selection дополнительно сравнивает `datasetVersion`. | [Resolver](../../../packages/datagrid-core/src/selection/virtualSelection.ts#L509), [row selection scope](../../../packages/datagrid-core/src/core/gridApiRowSelectionMethods.ts#L41). I03 показывает пробел для pass-through structural changes. |
| `columnKey` | Уникальная строка в column model; идентификатор UI/API колонки, порядка, размеров, selection и saved state. `field` может отличаться и указывает source property; accessor/valueGetter также участвуют в чтении. | [Column replacement validation](../../../packages/datagrid-core/src/models/columnModel.ts#L646), [cell value reader](../../../packages/datagrid-core/src/cells/runtime.ts#L340), [app guide](../../app-layer.md). Смена значения `field` при том же key не даёт модели новой logical-column generation. |
| Group row ID/key | Synthetic projection ID `group:` + length-prefixed пары field/value path. Значения предварительно преобразованы в строки; null и empty string совпадают, number 1 и string `"1"` совпадают. | [Projection](../../../packages/datagrid-core/src/models/projection/groupProjectionController.ts#L10), [normalizeText](../../../packages/datagrid-core/src/models/projection/clientRowProjectionAccessors.ts#L89). Разделители/Unicode внутри пути не ломают length encoding. Source/synthetic namespace collision не проверяется — I07. |
| Tree parent | Узел сохраняет source rowId; expansion key — `tree:parent:${String(rowId)}`. | [Materializer](../../../packages/datagrid-core/src/models/tree/treeProjectionParentMaterializer.ts#L5). Row lookup typed, expansion lookup теряет тип — I06. |
| Tree path | Synthetic `tree:path:` + length-prefixed нормализованные сегменты. Сегмент преобразуется в строку, trim; пустые сегменты удаляются. | [Primitives](../../../packages/datagrid-core/src/models/tree/treeProjectionPrimitives.ts#L18). Raw-type/empty-path policy следует отличать от source row identity. |
| Pivot row/column | IDs производны от encoded axis tuple и measure `(field, agg, aggregationId)`. Pivot заменяет row projection; orchestration добавляет generated columns к authored base schema. | [Pivot keys](../../../packages/datagrid-pivot/src/runtimeHelpers.ts#L20), [column composition](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L357). Generated-generated encoding для проверенных delimiter cases корректен; authored collision — I08. |
| Workbook / sheet | Workbook instance — самостоятельная область; публичного workbook ID в модели нет. Sheet ID уникален внутри workbook, canonicalized в lowercase ASCII slug; name/id aliases проверяются на collisions. Rows/cells локальны sheet. | [Sheet ID normalization](../../../packages/datagrid-core/src/spreadsheet/workbookModel.ts#L238), [sheet creation](../../../packages/datagrid-core/src/spreadsheet/workbookModel.ts#L924). Повторное использование sheet ID после remove создаёт новую модель/содержимое. Два workbook с одинаковым sheet ID изолированы. |
| Persistence key | Область saved preferences задаёт host: table + schema version + user/account. Field rename/filter semantics требуют нового key/schema version или migration в load. | [Публичный persistence contract](../../datagrid-state-persistence.md), [generation guards](../../../packages/datagrid-vue/src/app-layer/useDataGridStatePersistence.ts#L143). Здесь существующего host key достаточно; новый dataset ID в рамках аудита не предлагается. |

## Состояния и владельцы

Обозначения: **сохранить** — тот же logical entity; **очистить/отклонить** — identity больше не разрешается; **stale** — snapshot не имеет права считаться текущим; **migration** — host явно переносит состояние между смыслово разными областями.

| Состояние | Владелец и ключ | Обычный refresh / временное скрытие | Удаление, reuse ID, новый dataset/schema |
| --- | --- | --- | --- |
| Explicit selected/focused rows | Injected selection service; Core facade / Vue `useDataGridAppRowSelection`; typed row IDs | Core сохраняет explicit IDs независимо от фильтра. Vue reconciliation может prune отсутствующие projected IDs после cell-change. | Смена данных сама по себе не вводит generation ID. Policy permanent deletion/reuse требует определения у host; I01 доказывает недопустимое смешение разных typed IDs. |
| All-selection | Core row-selection facade, projection revision + datasetVersion | **Сохранить**, пока scope current; после смены logical projection **stale**, явный set/restore создаёт новый scope. | I03: pass-through replacement ошибочно остаётся current. Explicit restore all-mode намеренно привязывает scope к текущему view; это подтверждённый прежний #11 fix. |
| Active cell / cell ranges | Selection capability, endpoint row IDs + positional coords + projection/column revisions; Vue selection adapter | Сохранять logical target либо re-resolve; viewport window не должен инвалидировать identity. | Missing target должен стать stale/clear/unavailable, либо явно мигрировать. I03/I04 сохраняют несогласованные rowId/coords как current. |
| Active editor | Vue inline-edit state `(rowId,columnKey,initial source value,draft)` | Re-resolve stable target; изменившееся source value даёт external-update-conflict. | Проверенная смена field/type schema закрывает editor, source не меняется. Same-key semantics/reuse без boundary остаются policy вопросом. |
| Height overrides | Core API maps по typed rowId, отдельно fallback index overrides | By-ID override сохраняется при sort/filter/collapse. | По [view contract](../../../packages/datagrid-core/docs/reference/api/methods/view.md) removal не очищает ID override; reuse получает прежнюю высоту, пока host не clear. Это **намеренное удержание**, не новая утечка. |
| Computed/dependency caches | Core model-local registry/overlay, source identity/versions, formula definitions | Пересчитывать зависимые inputs; сохранять валидные derived caches. | Проверены setRows same ID, remove/readd, unregister/register formula: новых старых computed значений нет. I05 — отдельный derived group-value cache с недостаточным ключом. |
| History | Core transaction service; Vue/orchestration client snapshots и closures, runtime/session lifetime | History сохраняется между обычными edits/refresh; undo восстанавливает snapshots. | Замена props.rows другим dataset с тем же ID не объявлена новой history областью. В repro Undo вернул payload A поверх B. Это **опасная неоднозначная политика**, а не автоматическое доказательство нарушенного dataset contract; remount/dispose задаёт явную новую lifetime. |
| Optimistic pending edits | Datasource mutation engine, transaction ID + typed rowId; baseline node содержит старый sourceIndex | Принятый write должен сохраниться при query changes того же dataset; overlay сопоставляется по ID. | Dispose отменяет undispatched commits по предыдущему fix. I02: rollback использует старый query index, повреждает текущую projection. Новый dataset в той же mutable host datasource closure не различим автоматически. |
| Group expansion | Model-local toggled string keys | Сохранить для того же group path; setGroupBy меняет domain и очищает toggles. | Same path in новом dataset логически получает прежнее значение в той же модели, если host не сбросил. I06 нарушает идентичность двух существующих разных родителей. |
| Generated columns / retained base schema | Orchestration runtime; generated tuple+measure ID, authored column key, retained stateByKey | Сохранять state тех же columns; pivot off восстанавливает актуальную authored schema. | I08 скрывает метрику при collision; I10 возвращает старый getter после callback-only source replacement. Field/type change через public setAll в проверенном обычном случае работает. |
| Saved/restored state | Core unified V1; Vue saved view/persistence owner | Layout по известным keys сохраняется, deleted keys исключаются, new keys получают defaults. | Перенос между dataset/schema требует host key/migration. `state.validate` проверяет version/capabilities, не доказывает semantic compatibility. I04 — отдельное нарушение согласованности selection при частичном restore. |

## Подтверждённые findings

Нумерация этого отчёта локальна. Для всех findings уверенность высокая; достижимость advanced utility отдельно ограничена в I12. Все проблемы остаются открытыми.

### I01 — P1: Vue удаляет обе записи `1` и `"1"`, хотя выбрана одна

- Данные: `[{rowId:1,name:'number'}, {rowId:'1',name:'string'}]`, одна колонка `name`, rowSelection/rowIndexMenu включены.
- Путь 1: contextmenu индекса первой строки → `delete-selected-rows`. Путь 2: exposed `runStructuralRowAction('delete-selected-rows', 1)`. Оба воспроизведены в настоящем mounted Vue компоненте в jsdom.
- Ожидание: останется строка с ID `"1"`. Факт: rowCount **0**.
- Причина: [normalization structural target](../../../packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts#L4376) → [resolveDataRowId](../../../packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts#L3218) возвращает строку → [removeRuntimeRows](../../../packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts#L3553) фильтрует оба объекта одним `Set<string>`.
- Минимальный fix owner: Vue structural-row flow должен передавать typed ID до Core mutation, а DOM string dataset разрешать через row index/typed runtime node. Нельзя удалять записи через сравнение stringify ID. Проверить соседние cut/move/reorder readers с тем же resolver.
- Недостающая regression: публичный typed action и UI menu с обоими типами ID, ровно одна удалённая запись; отдельный тест для string-only IDs с пробелами/разделителями.

### I02 — P1: optimistic rollback пишет строку из старого query в индекс другой записи

- Начало: query ascending возвращает `A(v=10),B(v=20)` по индексам 0,1. Patch `A.v=99`; commitEdits удерживается deferred Promise.
- Пока write pending: `setSortModel(desc)`; новый pull возвращает `B,A`. Overlay A по ID корректно виден в индексе 1: `B20,A99`.
- Commit отклоняется. Ожидается `B20,A10`. Факт: **`A10,A99`**, B потеряна в cache, A продублирована.
- Причина: [rollbackOptimisticTransaction](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L498) берёт transaction.baseline и [пишет его по сохранённому sourceIndex](../../../packages/datagrid-core/src/models/dataSourceBackedRowModel.ts#L511), не проверяя текущий query/row at index. Это реальная смена sort того же datasource, не подмена host dataset.
- Минимальный fix owner: datasource cache/optimistic rollback — разрешать текущий target по typed rowId; при query generation change не записывать baseline index. Восстанавливать только принадлежащие rejected edit поля в подтверждённую current row либо invalidate/re-pull текущего view. Не затирать более свежие поля и последующие pending transactions.
- Отличие от exception-safety F05: там исправляли mixed rejection/post-confirmation publication. Этот repro — обычный транспортный отказ одной операции после смены query; прежний fix присутствует и его тесты проходят.

### I03 — P1: pass-through structural projection не инвалидирует cell/all selection

- A: одна строка `{id:'A',v:1}`, без sort/filter/group/pivot. Cell snapshot указывает `(index0,id'A')`, all-selection привязан к текущей projection.
- `setRows([{id:'B',v:2}])`; затем explicit `refresh()` для устойчивой точки.
- Факт: row-model revision **1 → 3**, `projection.recomputeVersion` **0 → 0**; cell/all scope оба **current**, active rowId остаётся A, row at index0 — B.
- Причина: [runtime state](../../../packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts#L184) увеличивает recomputeVersion только при `hadActualRecompute`; plain pass-through materialization не считается actual stage recompute. [Selection identity](../../../packages/datagrid-core/src/selection/virtualSelection.ts#L509) предпочитает этот счётчик, поэтому fallback на изменившийся row revision не используется.
- Минимальный fix owner: Core projection identity должен отражать изменение состава/порядка logical rows и pass-through structural operations. Не заменять его безусловно на row-model revision: viewport-window ticks не должны делать selection stale. Чистое изменение значения при неизменных ID также не требует blanket clear.
- Regression: replace/insert/remove/reorder без активных query stages; cell identity и all-scope становятся stale при изменении row identities; viewport-only и обычный value patch сохраняют current.

### I04 — P1: partial state restore переобъявляет отсутствующий logical target текущим

- A: строка A, колонка v, активная ячейка `(0,0,rowId:'A')`; сохранить `state.get()`. Для изоляции от I03 включена сортировка v.
- B: `setRows([{id:'B',v:2}])`. Live selection корректно stale. Затем `state.set(saved,{strict:true,applyRows:false,applyColumns:false,applyViewport:false})`.
- Факт: `validate` valid=true; snapshot становится **current**, но его active/endpoints rowId A не существует, индекс 0 принадлежит B.
- Причина: [restore selection](../../../packages/datagrid-core/src/core/gridApiStateMethods.ts#L478) копирует старые coords/IDs и без проверки ставит текущие projection/column revisions. [Validation](../../../packages/datagrid-core/src/core/gridApiStateMethods.ts#L252) не проверяет target identity/bounds. Похожий restamp есть в rollback restore branch.
- Минимальный fix owner: Core state restore — сопоставить сохранённые endpoint IDs и исходные column order keys с target projection/schema. Если логический target не разрешается, отклонить/пропустить или оставить stale по явной restore policy; strict report не должен обозначать несогласованную selection как успешно актуальную. Здесь не нужен новый dataset ID: mismatch A/B уже известен.
- Это не повтор прежнего consistency #11: тот fix согласовал revision resolver для all-mode; он работает. Новый repro — потеря logical target в cell selection при поддерживаемом partial restore.

### I05 — P1: group-value cache объединяет разные `(rowId,field)`

- Typed IDs: `[{id:1,g:'A'},{id:'1',g:'B'}]`, groupBy g expanded. Ожидание: два group nodes A/B по одному leaf. Факт: одна группа **A с childrenCount=2**.
- Все ID строки: `{id:'a','b::c':'parent-A',c:'child-A'}` и `{id:'a::b','b::c':'parent-B',c:'child-B'}`, groupBy `['b::c','c']`. Второй дочерний group value **parent-A** вместо child-B.
- Ключ: [group cache resolver](../../../packages/datagrid-core/src/models/projection/groupProjectionController.ts#L82) использует `${String(rowId)}::${field}`. Теряется тип ID, а delimiter не отделяет tuple однозначно; во втором repro оба cells используют `a::b::c`.
- Минимальный fix owner: Core group derived cache — typed tuple encoding либо nested typed maps с сохранением cache budget/invalidation. Length-prefixed **group path ID** здесь уже корректен и не исправляет отдельный cache lookup.
- Regression: typed IDs; delimiter внутри rowId/field; агрегаты/membership обеих групп; edit и source replacement после прогрева cache.

### I06 — P1: tree parent expansion путает number/string родителей

- Данные: parent 1 с child n и parent `"1"` с child s. Source lookup/parent links typed и начально корректны.
- Оба group key: **`tree:parent:1`**. Collapse key первого parent закрывает второй: результат **`[1,'n','1']`** вместо `[1,'1','s']`. Explicit refresh закрывает уже обоих: `[1,'1']`.
- Причина: [createTreeParentGroupKey](../../../packages/datagrid-core/src/models/tree/treeProjectionParentMaterializer.ts#L5) stringify ID; [reverse map](../../../packages/datagrid-core/src/models/tree/treeProjectionParentCache.ts#L227) перезаписывает number parent строковым, а full materializer применяет один toggle к обоим.
- Минимальный fix owner: Core tree expansion — сохранить тип в generated groupKey, согласовать materialize/incremental reverse maps. Учесть migration старых persisted expansion keys; при mixed IDs прежний key уже неоднозначен, его нельзя молча приписать одному родителю.

### I07 — P2: source и synthetic group row могут получить одинаковый projected ID

- Данные: одна source запись `{id:'group:1:g1:A',g:'A'}`; groupBy g expanded.
- Факт: projected IDs **`['group:1:g1:A','group:1:g1:A']`**, kinds group/leaf. Source duplicate validation проходит, потому что source ID всего один.
- Причина: [synthetic rowId assignment](../../../packages/datagrid-core/src/models/projection/groupProjectionController.ts#L151) использует публично допустимую строку без collision check. Документы отличают synthetic ID от record ID, но не резервируют запрещённый namespace source IDs.
- Минимальный fix owner: Core projection namespace policy/validation. Проверять collision до публикации и дать явную ошибку либо последовательно разнести identity домены всех readers по kind; простая смена произвольного строкового prefix не исключает collision. Возможное резервирование prefix требует compatibility/migration решения.
- Проверено дублирование projected identity; конкретный браузерный render/state перенос для этой пары не воспроизводился и не заявляется отдельно.

### I08 — P2: authored column с generated pivot key скрывает метрику

- Data: team A, year2024, revenue10, note='authored'. Получить generated metric key для pivot `(rows team,columns year,sum revenue)`, затем создать authored колонку с этим key и `field:'note'`.
- Generated ID: `pivot|pivot:column:4:year4:2024|pivot:agg:3:sum0:7:revenue`.
- При pivot on совпавшая колонка остаётся authored `field=note`, становится hidden, generated metric пропускается; visible columns — только team. Runtime pivot data при этом содержит метрику.
- Причина: [buildEffectiveColumns](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L357) добавляет base key в seen, затем [skip совпадающего generated key](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L391). Ошибки/диагностики collision нет.
- Минимальный fix owner: orchestration pivot/base schema composition должна отклонять или явно разрешать такой конфликт; нельзя молча считать authored definition generated metric. Публичного запрета authored `pivot|...` keys не найдено.

### I09 — P2: sort equality shortcut считает разными tuple одинаковыми

- Rows: r1 `{c:1,'b:c':9}`, r2 `{c:2,'b:c':0}`.
- Sort A: `{key:'a:b',field:'c',direction:'asc'}`; затем Sort B: `{key:'a',field:'b:c',direction:'asc'}`.
- Факт: второй setter no-op, сохраняет A и `[r1,r2]`; fresh model B и независимый числовой порядок дают **`[r2,r1]`**.
- Причина: [serializeSortValueModelForCache](../../../packages/datagrid-core/src/models/projection/clientRowProjectionSort.ts#L6) соединяет key/field/direction/deps/comparator через `:`/`|` без encoding. Оба описания имеют одинаковую строку `a:b:c:asc::null`; shortcut участвует в semantic equality, а не только в диагностике.
- Минимальный fix owner: Core sort-model equality/cache signature — structural typed tuple serialization с однозначным encoding элементов и массива dependencyFields. Проверить составные separators и многоколоночные descriptors.

### I10 — P1, остаток прежнего #6: callback-only schema replacement теряется после pivot roundtrip

- Base columns team и v с getter `()=>'old'`. Через **`api.columns.setAll`** заменить v getter на `()=>'new'`, оставив key/field/label теми же. Непосредственно после setAll column model содержит новый getter.
- Pivot on `(team,year,sum revenue)` → pivot off. Факт: v снова содержит **старый getter**.
- Причина: [serializeBaseColumnsSignature](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L194) кодирует только наличие getter/setter (`getter:1`/`setter:1`), не function identity; [column schema subscriber](../../../packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts#L556) решает, что схема не изменилась, и оставляет прежний baseColumns.
- Это **не новая общая finding про отсутствие schema sync**: consistency #6 уже исправлен для key/field/label/schema replacements, related suite проходит. Новая проверка выявила неполное закрытие callback identity.
- Минимальный fix owner: существующий orchestration base-schema comparator должен учитывать semantic definition identity, включая функции, отдельно от runtime width/pin/order state. `runtime.setColumns` force path не заменяет обязанность поддерживать уже принятый public `api.columns.setAll`.

### I11 — P1: composite edit-store key перезаписывает другую логическую ячейку

- Пара cells: `(rowId:'a',columnKey:'b::c')` и `(rowId:'a::b',columnKey:'c')`. Создать edit 'first' для первой, затем 'second' для второй.
- Ожидается два edit patches. Факт: один; `getEdit('a','b::c')` возвращает patch для **rowId a::b / column c**. Ошибочно переносится само canonical pending edit состояние.
- Причина: [makeEditKey](../../../packages/datagrid-core/src/models/editModel.ts#L46) строит `string:a::b::c` для обеих tuple. Тип rowId сохранён, но delimiter неэкранирован. Все входные IDs/keys валидны текущим public validator.
- Минимальный fix owner: Core edit model — nested map keyed typed rowId then columnKey, либо однозначное tuple encoding. `getEdit`, `setEdit`, `clearEdit` должны использовать одну identity схему. Regression: две cells сохраняются независимо; clear первой не очищает вторую; number/string distinction сохраняется.

### I12 — P2, advanced utility: group metadata путает typed row IDs

- Вход `[{id:1,g:'A'},{id:'1',g:'B'}]` в `useDataGridGroupMetaOrchestration` с groupBy g.
- Факт: snapshot.groups **1** вместо 2; badge для number1 — **`B (1)`** вместо A(1).
- Причина: [string-keyed metadata](../../../packages/datagrid-orchestration/src/grouping/useDataGridGroupMetaOrchestration.ts#L35) принимает `resolveRowId: string|number`, но writes и reads stringify ID.
- Минимальный fix owner: этот orchestration utility должен сохранять typed identity либо явно ограничить контракт строковой domain с валидацией; возвращаемые Set/Map types сейчас строковые, поэтому compatibility нужно учитывать.
- Достижимость: утилита проверена напрямую. Её использование для канонической grouping в стандартном Vue renderer не установлено; влияние на готовый DataGrid отдельно не заявляется.

## Неоднозначные политики и риски

1. **Dataset A/B внутри той же модели с повторным ID.** По существующему контракту ID стабилен в model lifetime; `setRows`/props.rows не имеют параметра «это другой tenant/dataset». Нельзя доказать ошибку, только переименовав набор A в B в тесте. Для обычного refresh сохранение selection/height полезно. Host persistence key и новая model/component lifetime уже могут задавать границу; новый обязательный dataset ID не предлагается.
2. **История после замены source с тем же ID.** Реальный Vue: edit A→edited-A, props.rows заменить на `{rowId:42,name:'B',dataset:'B'}`, Undo → `{rowId:42,name:'A',dataset:'A'}`. History single-session и snapshot-based; автоматический clear на props change не обещан. Это существенный integration hazard для переключения аккаунтов/таблиц. Нужна явная политика reset/recreate/migrate, а не blanket clear на каждом refresh. Core transaction restore в unified state по-прежнему unsupported; это корректно сообщается существующим контрактом.
3. **Permanent deletion vs temporary hidden selection.** Core explicit ID state сохраняется. Vue `reconcileRowSelectionFromRuntime` строит allowed IDs по текущей projection, и `DataGrid.handleCellChange` вызывает его. Существующий contract test намеренно prune collapsed descendants. Политика сохранения record selection между filter/collapse/edit не унифицирована в public docs; end-to-end filter→edit→clear не воспроизведён здесь как отдельный finding.
4. **Semantic column reuse.** Совпавший key означает одну logical column для layout/state, но смена field/type может менять допустимость фильтра, draft и истории. В проверенном Vue schema-update editor закрылся без записи, cells resolver переключился на новый field; автоматическая миграция любых старых фильтров/истории не сертифицирована. Persistence docs уже требуют schema key/migration при переименовании field/смене filter semantics.
5. **Generated namespaces.** I07/I08 подтверждены для group rows и pivot columns. Аналогичный user collision с `tree:path:` и server-generated pivot/placeholder IDs исследован по source namespaces, но не выполнен отдельным integration repro; не расширять механически findings на все synthetic kinds.
6. **Optimistic success payload vs query ownership.** I02 подтверждает внутренний rollback bug. Mutation response с rows/indexes, рассчитанными для старого query, также требует явной host protocol/invalidation policy; успешный stale-position response отдельно не воспроизведён, его нельзя автоматически отнести к Core нарушению без server contract.
7. **Raw grouping type/empty policy.** Grouping/pivot используют normalized strings: null/undefined/empty string — одна bucket, 1/`"1"` — одна. Tree path trim/stringifies и удаляет empty segments. Это текущая согласованная реализация, а не collision разных source row IDs. Публичную raw-type policy следует описать до её изменения; неправильный результат на этом основании не заявляется.
8. **Column signature delimiter ambiguity.** Помимо подтверждённого callback-identity остатка I10, `serializeBaseColumnsSignature` использует неэкранированные `|`/`||`. Adversarial field/label tuples потенциально могут совпасть. End-to-end repro этого отдельного случая не выполнен: это риск, не дополнительный confirmed finding.

## Проверенная матрица A–K

| Сценарий | Реально выполнено | Результат |
| --- | --- | --- |
| A. A→B, ID42 совпадает | Client setRows same ID с другой source value и computed field; две независимые модели и workbook; Vue props replace + Undo | Computed cache обновлён; instances изолированы. History retention — policy hazard, не доказанный dataset boundary defect. |
| B. Filter hide/return | Core explicit selection + height override; filter applied/cleared | ID state сохраняется. All-scope с активной sort projection становится stale при membership replacement. Vue prune policy отдельно в неоднозначностях. |
| C. Remove/readd ID | Formula row remove/append; height by-ID; sheet remove/add same ID | Formula свежая; height намеренно сохранена; новая sheet не наследует cells. |
| D. Query late response | Deferred old pull после нового результата с datasetVersion20; pending optimistic edit + sort change + reject | Stale pull безопасно отброшен. Rollback повреждает cache — I02. |
| E. Same key new field/type | Core cells.resolveValue после setAll; настоящий Vue active draft; callback-only schema replacement + pivot | Direct resolver читает новый field; editor закрылся; I10 getter resurrected. |
| F. Column remove/readd | Core column setAll empty → прежний key с другой field | Cell resolver использует новую definition; arbitrary old filter/history migrations не проверены. |
| G. Formula same name reuse | Register `double=v*2`, remove row/readd, unregister, register `double=v*3` | Значения 16→6→9 соответствуют независимой арифметике; old registry overlay не проявился. |
| H. Generated/authored keys | Group source ID equals generated ID; pivot generated column ID equals authored key | I07/I08. Другие synthetic namespaces не обобщаются. |
| I. `1` vs `"1"` | Source lookup/patch/selection; grouping cache; parent tree; advanced metadata; Vue menu и typed exposed delete | Core basic lookup/selection различают. I01/I05/I06/I12 нарушают typed identity в отдельных owners. |
| J. Separators/empty/null/Unicode/types | Group `a|b`, `a:b`, empty/null, 雪, 1/`"1"`; distinct two-level tree paths; composite edit/group/sort tuples | Length-prefix paths корректны; string normalization имеет собственную policy. Неэкранированные cache/lookup signatures — I05/I09/I11. |
| K. Compatible/incompatible restore | Unified all-selection restore; cell partial restore с отсутствующим rowId; field/key replace; два workbook scopes | Explicit all restore rebind допустим. Cell restore — I04. Arbitrary persisted-state migrations между tenants/schema не объявлены безопасными. |

## Проверенные roundtrips без расхождений

- Typed source IDs basic getById/patch и explicit row-selection storage.
- Model-local computed overlays при same-ID replacement и remove/readd; arithmetic values после formula unregister/register.
- Direct field/type replacement и remove/readd columnKey в cell resolver.
- Отбрасывание позднего pull старого query, включая его старую datasetVersion.
- Length-prefix encoding проверенных group/tree paths с разделителями/Unicode.
- Height override retention по явно опубликованной политике.
- Independent model/workbook same-ID isolation; duplicate canonical sheet ID rejection; sheet recreation со свежими cells.
- Current all-scope после explicit restore на actual-recompute projection; прежний consistency #11 fix сохранён.
- Vue editor закрывается на проверенной смене source field без применения старого draft к новой source property.

## Ограничения и минимальный порядок исправлений

1. I01/I02/I11: сначала не допускать удаления лишней записи, записи baseline в чужой query index и смешения canonical edits.
2. I03/I04: согласовать logical projection freshness и restore target resolution, сохранив viewport-only current behavior.
3. I05/I06: исправить typed/composite cache keys и tree expansion key; учесть persisted expansion migration.
4. I10: закончить прежний base-schema fix с учётом callback identity. I08/I07: выбрать явную compatibility policy для authored/generated namespace collisions.
5. I09 и advanced I12: однозначные signatures/typed metadata; не переносить legacy helper в canonical grouping path.

Product builds/type-check/release/tarball checks в этом read-only аудите не запускались. Новые diagnostics импортируют актуальный source через workspace aliases; Vue SFC реально скомпилированы и смонтированы Vitest. Нет real-browser visual/focus/scroll validation, remote HTTP/backend/worker checks, DOM/Laravel audits, exhaustive workbook reference-rewrite проверки или доказательства математической корректности всего projection engine. Производительность и memory safety не переаудировались. Независимые expected в repro — literal ID sequences, cell tuples и простая арифметика; fresh sort model использован дополнительно и не является единственным oracle.
