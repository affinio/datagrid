# Affino DataGrid: перегрузка, очереди и завершение операций

Дата: 2026-10-24. Статус: аудит завершён; продуктовые исправления **не выполнялись**. Восемь подтверждённых дефектов ниже остаются открытыми. Недостающие лимиты и неоднозначные гарантии перечислены отдельно.

Область: Core, orchestration, Vue, worker transports и общий `datagrid-server-client` как producer change-feed. DOM/Laravel и реализация backend не проверялись.

## Исходная точка и достоверность

- Commit: `79092ff0e7ba27181237c3e4db57b1186f157be0` (`fix(datagrid): release disposed caches and bound history`). Дерево уже содержало изменения Vue chrome, selection, sandbox и других файлов. Во время аудита параллельно появились дополнительные изменения clipboard/pinned-pane/docs/e2e; это не изменения данного аудита. Список дерева на момент финальной фиксации — [артефакт](./202610/datagrid-overload-results.json), `workingTreeChangesAtCapture`; hashes десяти ключевых queue/activation owners совпадают с HEAD. Browser fixture пересобран и измерен на финальном доступном дереве. Аудит добавляет только свои scripts/docs; исходники продукта и публичные API им не менялись.
- Node `24.21.0`, pnpm `10.30.3`, Linux aarch64/OrbStack, 10 логических CPU, Apple/виртуализированная среда. Chromium `145.0.7632.0`, headless, viewport `1200×800`. Точные версии пяти пакетов и V8 записаны в JSON.
- Прочитаны [consistency audit](./datagrid-consistency-audit-2026-10.md), [exception-safety audit](./datagrid-exception-safety-audit-2026-10.md), [compute/projection audit](./datagrid-incremental-compute-projection-audit-2026-10.md), [cost audit](./datagrid-computational-cost-audit-2026-10.md), memory-cleanup commit и существующие datasource/worker pressure harnesses. Ранее исправленные startup/transaction disposal, optimistic publication и failure recovery не заявляются новыми находками.
- Текущие существующие проверки: **11 файлов / 163 теста passed** — Core failure recovery/lifecycle/datasource/compute, worker transport/owned/parity, orchestration refresh batcher, server-client poll/WebSocket, Vue active-cell viewport.
- Новый [harness](../../../scripts/audits/datagrid-overload/README.md): **25 сценариев passed**. Названия `DIAGNOSTIC` утверждают наблюдаемое неправильное поведение; зелёный запуск не означает корректность продукта. Остальные сценарии проверяют здоровые переходы и измеряют риски.
- Browser fixture реально собран Vite в production, `PROD=true`; это настоящий Vue DataGrid. Выполнены 30 timing samples, 6 warm-ups, отдельные counted runs, activation/unmount и очередь из 10 000 callbacks. Ошибок страницы в окончательном запуске нет. Это не jsdom-вывод о браузерной отзывчивости.
- Математический аудит не повторялся. В browser workload используются `excel-like`, `autoReapply=true`, активная сортировка, цепочка `value → double → plus`; после устойчивой точки проверяются последнее записанное значение и независимая арифметика `plus = value * 2 + 1`. Отложенную проекцию с полной не сравнивали.

## Карта очередей

Лимит числа записей в JS-структуре не равен лимиту уже переданных transport сообщений или времени одного callback.

| Очередь / владелец | Producer → consumer; порядок | Лимит и объединение | Cancellation / переполнение | Stop/dispose и наблюдаемое завершение |
| --- | --- | --- | --- | --- |
| [Foreground pulls](../../../packages/datagrid-core/src/models/server/dataSourcePullRequestPolicy.ts#L42), [scheduler](../../../packages/datagrid-core/src/models/server/dataSourceScheduler.ts#L25) | viewport/query/refresh → `dataSource.pull`; latest relevant query/range, не FIFO всех viewport requests | Один foreground lane для critical/normal, один pending foreground slot и один scheduled-viewport slot. Совпадающий key/покрывающий диапазон переиспользуются; viewport intent объединяется в microtask | Новая critical/query работа preempts старую через AbortSignal; pending более низкого приоритета уступает более высокому. Число **физических** запросов зависит от соблюдения abort transport-ом | Dispose aborts lanes и очищает slots. `refresh()` возвращает Promise, но queued pending pull может вернуть completion текущего lane, а не собственного будущего запроса. Для foreground drain нужен `data.flush()`; diagnostics/model events наблюдают loading/error |
| [Background prefetch](../../../packages/datagrid-core/src/models/server/dataSourcePendingPullRuntime.ts#L44) | viewport/prefetch policy → background pull; ниже foreground | Один active background lane + один pending slot. Покрывающие/смежные диапазоны объединяются, stale intent вытесняется; это не очередь пользовательских commits | Предпочтение foreground, abort stale/preempted, skip cached; pending диапазон может быть заменён | Dispose очищает; `data.flush()` **не ждёт** background. Diagnostics содержат prefetch counters; отдельного публичного Promise на каждый prefetch нет |
| [Optimistic commits](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticMutationEngine.ts#L116) | `patchRows` → `commitEdits`; FIFO Promise chain | Один выполняющийся commit; очередь и transaction maps без admission limit. Отдельные вызовы не объединяются; внутри вызова patches одного rowId объединяются | Нет общей timeout/queue-cap политики. Текущий runtime не создаёт commit AbortController. Pull pause не останавливает writes | Promise каждого patch — completion/error. Loading включает optimistic mutations. Dispose очищает maps, **но не отменяет queued closures**: F03. `data.flush()` writes не ждёт |
| Прямые datasource writes/fill | Host/interaction → предоставленный потребителем transport; порядок зависит от соответствующего flow | Сам `DataGridDataSource` — интерфейс, не универсальный write scheduler. Fill/execute-operation не проходят автоматически через optimistic edit queue | Signal/operationId и серверная идемпотентность зависят от отдельного метода/host. Нельзя приписывать им pull coalescing | Promise transport-операции. Общий server-client реализует read transport; его комментарий явно оставляет write/fill/history host wrapper-у. Реальный backend pressure не измерялся |
| [Core push application](../../../packages/datagrid-core/src/models/server/dataSourcePushEventRuntime.ts#L19) | subscribed upsert/remove/invalidate → cache/projection notifications | Синхронная обработка; application queue отсутствует. Каждый принятый upsert выполняется; это не debounce последних данных | Pull pause не означает pause push. Очередь браузерных/network событий вне этой функции; source обязан поддерживать подходящий порядок/revision policy | Dispose отсоединяет subscription и игнорирует late push. Завершение callback синхронное; model events сообщают применение, отдельного drain Promise нет |
| [Change-feed polling](../../../packages/datagrid-server-client/src/changeFeedPoller.ts#L122) | interval/manual poll → fetch/retry → onResponse | В нормальном одном поколении один request; ticks во время него пропускаются, а не копятся. Минимальный интервал 250 ms | stop/restart generation + abort; отдельной очереди ticks нет. Retry работает внутри текущего запроса | `pollNow()` Promise для начатого запроса; если polling выключен или busy — немедленный return. `stop()` синхронный, не transport drain. Restart race нарушает single-flight: F05 |
| [WebSocket change feed](../../../packages/datagrid-server-client/src/webSocketLiveUpdateTransport.ts#L144) | socket message → synchronous onResponse | Application queue/coalescing отсутствует; один socket и один reconnect timer | generation/socket identity отсекают старые handlers. Flow-control кредита, acknowledgement или bounded message buffering на этом слое нет | stop снимает handlers, закрывает socket, отменяет reconnect. `pollNow()` проверяет/восстанавливает connection, не является message drain |
| [Client compute](../../../packages/datagrid-core/src/models/compute/clientRowComputeRuntime.ts#L160) | mutations/configuration → projection orchestrator | Sync исполнение по умолчанию, без job queue. Worker mode без custom transport использует loopback, также sync. Explicit batch может объединить совместимую работу по своему контракту | Один sync pass нельзя отменить/прервать пользовательским вводом. При `handled:false` выполняется sync fallback | Completion sync метода/определённого batch; `whenIdle` не превращает его в render/network barrier |
| [Compute postMessage transport](../../../packages/datagrid-worker/src/postMessageTransport.ts#L137) | compute request → host callback/ACK | 32 unacknowledged metadata entries; timeout по умолчанию 15 s. При cap — `handled:false`, текущий Core делает sync fallback. Default `sync-fallback` также возвращает false после отправки | ACK/error/timeout очищают bookkeeping; timeout не удаляет уже отправленное сообщение и не отменяет host computation. `fire-and-forget` имеет другую completion семантику | Stats: sent/acked/errored/timedOut/inflight, отдельного public Promise на запрос нет. Dispose снимает listener и timers; последующий dispatch не защищён — G01 |
| [Worker-owned commands](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L556) | proxy mutations/query/viewport → worker-owned Core → delta/full updates | Microtask queue; flush на 64 commands или patch burst ≥1024 updates. Это flush thresholds, не IPC credit. Cache окон ограничен 8. Type-based coalescing нарушает семантику: F01/F02 | Incoming stale requestId отбрасывается; это безопасно только при совместимом порядке и delta baseline. ACK-based admission cap для posted commands нет | Proxy dispose удаляет listener и ещё не отправленные commands; host/Worker отдельно принадлежат своему creator. Mutation methods void; subscription/snapshot/error observable, per-command public completion/flush отсутствует |
| [API exclusive lifecycle](../../../packages/datagrid-core/src/core/gridApiLifecycleRuntime.ts#L48) | guarded operations / runExclusive → serial callback | FIFO Promise chain, без capacity limit, dedupe или time slice. Ошибка одной задачи не портит chain | Принятые callbacks не объединяются. Sync guarded вызовы при busy отклоняются согласно контракту | `runExclusive()` Promise; `whenIdle()` ждёт active+queued=0, включая пополнение очереди. Core stop не terminal, dispose terminal, но ранее queued callbacks всё ещё запускаются: F04 |
| [Core cell refresh](../../../packages/datagrid-core/src/core/gridApiCellRefresh.ts#L72) | cell invalidations → microtask → visible-entry resolver/listeners | Один scheduled microtask; map rowId → set columns, без admission limit. К моменту flush не видимые ячейки отсеиваются | Допустимо объединять invalidations одной ячейки. Это не выполнение бизнес-изменений и не подтверждение записи | API dispose отменяет pending callback и очищает maps/listeners. Завершение через refresh event; `whenIdle()` этого не обещает |
| [Orchestration refresh batcher](../../../packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher.ts#L51) | queued ranges → RAF/timer → refreshCellsByRanges | Map rowId → column set; FIFO distinct rows. `maxBatchSize` ограничивает ranges за flush, `frameBudgetMs` — сборку batch, не исполнение consumer. Оба по умолчанию Infinity; capacity limit отсутствует | Duplicate cells объединяются. Public `flush()` обрабатывает очередной batch, не Promise drain. F06 ломает frame accounting, F07 — drain после ошибки | Dispose очищает map и известный frame handle; потерянные handles F06 остаются. `onBatchFlush` сообщает chunk, общего completion Promise нет. Вызов этого helper из стандартного Vue renderer не установлен; репро — advanced consumer helper напрямую |
| [Visible rows / measure / chrome / viewport frames](../../../packages/datagrid-orchestration/src/viewport/useDataGridVisibleRowsSyncScheduler.ts#L94) | model/resize/scroll invalidations → frame reads/commit | В прикладных wrappers один pending frame и latest input, merge redraw modes. Общий Core RAF scheduler хранит task maps по priority и не имеет admission cap; viewport wrappers используют отдельные task IDs для dedupe | Refresh/sample requests можно схлопывать, так как input читается при исполнении. Scheduled callback отменяется teardown-владельцем | `dispose`/unmount отменяют известные handles. Общий frame `flush` sync; Vue `nextTick` не paint barrier. 1000 visible-sync requests → один frame с последним входом |
| [Vue activation/reveal](../../../packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts#L4072) | `api.view.activateCell` → reveal/nextTick → identity recheck → focus/selection | Sequence/latest wins; накопленной explicit FIFO нет. Каждый вызов создаёт continuation и может выполнить первоначальный reveal до первого await | Superseded/aborted/disposed возвращают explicit cancelled result. Row/column identity переопределяется после reveal | Promise с `activated`/`unavailable`/`failed`/`cancelled`. Реальный unmount: 200/200 cancelled:disposed; burst: 199 superseded, последняя activated |

### Barrier contract

[Документированный `data.flush()`](../../../packages/datagrid-core/docs/reference/api/methods/datasource.md) дренирует foreground/critical работу, которую наблюдает loop, до пустой очереди. Он не является snapshot барьером фиксированного номера заявки, не ждёт optimistic writes, background prefetch или Vue paint. Продолжающийся поток может задержать завершение — **это не новый дефект**. Проверено временное resume и восстановление paused; отдельный resume снимает pause.

[`whenIdle()`](../../../packages/datagrid-core/docs/reference/api/methods/runtime.md) относится только к guarded exclusive queue. Pending network или пользовательский callback, который никогда не завершится, не получают timeout автоматически. `stop` может поддерживать restart; его нельзя приравнивать к terminal dispose.

## Подтверждённые дефекты

### F01 — P1 / высокая уверенность: worker coalescing переставляет бизнес-операции и ломает delta baseline

- Инвариант: допустимая последовательность записей должна применяться в исходном порядке; stale filtering не должно скрывать текущее состояние worker.
- Минимум: одна строка `{id:'r', value:0}`. В одном turn вызвать `patch(1) → setRows([{id:'r',value:10}]) → patch(2)`.
- Вместо ожидаемого worker value **2**, отправляются `patch(2), requestId=4 → setRows(10), requestId=3`; worker заканчивает со значением **10**. Proxy оставляет **2**, потому что update id=3 признаётся stale. Последующий explicit `refresh()` не исправляет mirror: host отправляет пустую delta относительно уже опубликованного 10, и proxy остаётся на 2.
- Причина: [поиск coalesce key по всей pending queue](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L629) заменяет старый slot, присваивая ему новый requestId. [Incoming stale-ID check](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L791) и [delta application](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L837) предполагают согласованный порядок публикаций.
- Минимальный путь исправления: объединять только доказанно совместимые contiguous patches; replacement/schema/query/другие non-commuting commands должны служить границами. Обеспечить согласованный порядок IDs и delta baseline. Простая перенумерация updates не восстанавливает исходную семантику mutations.
- Регрессия: точная тройка выше, независимый source oracle; проверить worker authoritative state, proxy, затем refresh, а не только первый mirror value.

### F02 — P1 / высокая уверенность: burst регистрации формул теряет принятые определения

- Минимум: `registerFormulaField({name:'a',field:'a',formula:'[value]*2'})`, затем такой же вызов для `b`, формула `[value]*3`, до microtask flush.
- Ожидается `[a,b]`, фактически зарегистрирована только **b**. Обе команды валидны; исключения/предупреждения нет.
- Причина: [getCoalesceKey](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L440) возвращает только тип `register-formula-field`; [mergeCommandPayload](../../../packages/datagrid-worker/src/workerOwnedRowModel.ts#L424) для него возвращает правую команду.
- Исправление: сохранять независимые definitions и порядок регистрации; не объединять разные logical fields. Совпадение одного имени само по себе также не разрешает объединение через промежуточные команды.
- Регрессия: две независимые registrations и dependency registration sequence; сравнить поля и значения с последовательным Core.

### F03 — P1 / высокая уверенность: optimistic queue выполняет unsent writes после dispose и скрывает failure уже начатого commit

- Минимум: первый `commitEdits` удерживается deferred Promise. Вызвать patch value=1,2,3; дождаться начала первого; dispose модели; разрешить первый.
- Фактически transport получает **1 до dispose, 2 и 3 после dispose**. Нельзя объяснить это необратимостью уже отправленного первого запроса: второй и третий ещё не были отправлены.
- Отдельный вариант: один commit уже начат; dispose; transport rejects `server rejected`. Public patch Promise **fulfilled**.
- Reference chain: [patch registers/enqueues transaction](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticPatchRuntime.ts#L65) → [commitQueue.then(task)](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticMutationEngine.ts#L116) удерживает callback/transaction независимо от очищенных maps → [commit runtime](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticCommitRuntime.ts#L38) сначала вызывает transport, только затем проверяет disposal; [catch](../../../packages/datagrid-core/src/models/server/dataSourceOptimisticCommitRuntime.ts#L81) превращает rejection после dispose в return.
- Исправление: disposal/generation check непосредственно перед dispatch queued commit, явное rejected/cancelled завершение unsent accepted work; для уже отправленного commit сохранить его реальный исход без мутаций disposed UI. Очищение maps не отменяет Promise chain. Не объединять разные server commits ради уменьшения очереди.
- Регрессии: deferred first + queued second + dispose; terminal first rejection не превращается в success; все возвращённые Promises определённо завершаются.

### F04 — P1 / высокая уверенность: API exclusive queue запускает ранее принятый callback после terminal dispose

- Минимум: start API; `runExclusive(() => gate)`; поставить второй callback с наблюдаемым эффектом; дождаться первого входа; `await api.dispose()`; разрешить gate.
- Ожидается, что ранее принятая, но не начатая задача не начинает работу на disposed runtime и получает явный terminal outcome. Фактически второй callback выполняется, lifecycle.state остаётся disposed.
- Причина: [queueExclusive](../../../packages/datagrid-core/src/core/gridApiLifecycleRuntime.ts#L48) не проверяет Core state перед извлечением callback и не имеет terminal invalidation. Это другой owner, чем ранее исправленный transaction executor и Core startup continuation.
- Диагностика также показывает новый runExclusive после dispose, но это запрещённое повторное использование API и **не считается независимым дефектом**. Finding основан на допустимой постановке задачи **до** disposal.
- Исправление: terminal check на enqueue/dequeue, явное завершение ещё не начатых задач; не пытаться отменить произвольный уже entered callback или его внешние эффекты. FIFO и rejection recovery сохранить.
- Регрессия: принятый до dispose queued callback не вызывается; его Promise и соответствующие idle waiters получают согласованный исход.

### F05 — P1 / высокая уверенность: старый polling finally снимает busy нового поколения

- Минимум с abort-compliant transport: `start()` начинает deferred request A; повторный `start()` aborts A и начинает B; дать rejection A завершиться; вызвать `pollNow()`.
- Фактически после finally A diagnostics.pending=false, хотя B жив. Начинается C одновременно с B. Resolve C=3, затем B=2 — onResponse получает **[3,2]**. Здесь transport корректно исполняет abort, зависшая реализация не нужна.
- Причина: [generation check защищает success](../../../packages/datagrid-server-client/src/changeFeedPoller.ts#L144), но [finally](../../../packages/datagrid-server-client/src/changeFeedPoller.ts#L163) без identity check очищает общий `pollAbortController`, cleanup и `pollInFlight` нового request. B и C принадлежат одному поколению и оба допускаются к publication.
- Downstream риск подтверждается кодом shared client: [applyChangeFeedResponse](../../../packages/datagrid-server-client/src/client.ts#L199) сохраняет монотонную datasetVersion, но всё равно dispatches changes из старого response; version bookkeeping не является защитой row values. Полный HTTP/client/browser сценарий этой гонки отдельно не исполнялся; непосредственно воспроизведены poller concurrency и порядок callbacks.
- Исправление: cleanup, diagnostics, retry/error callbacks должны принадлежать конкретному request/generation. Старое завершение не меняет состояние нового request. Single-flight восстановить, не вводя очередь пропущенных interval ticks.
- Регрессия: restart во время запроса, cooperative abort, late finally/error, новый запрос остаётся busy; третьего параллельного poll и delivery [new,old] нет.

### F06 — P2 / высокая уверенность: manual refresh flush теряет handles уже назначенных RAF

- Минимум: `queueByRanges([cell]); flush();` повторить 1000 раз без исполнения RAF.
- Фактически fake RAF содержит **1000 callbacks**, а не один/ноль. `dispose()` не отменяет ни одного из них. Они опустошаются при доставке frame и в репро повторно refresh не выполняют, но удерживают closures и создают лишний frame work.
- Причина: публичный `flush` — это [doFlush](../../../packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher.ts#L118), который обнуляет handle без cancel уже назначенного RAF. Следующий queue назначает новый frame; [dispose](../../../packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher.ts#L224) старые handles больше не знает. Ветка `immediate:true` отдельно отменяет handle правильно.
- Исправление: manual flush должен отменить outstanding scheduled callback до очистки handle; scheduled callback снимает только собственный handle. Новой очереди/сервиса не требуется.
- Регрессия: повтор queue/flush, затем dispose; число ожидающих frame callbacks ограничено и достигает нуля.

### F07 — P2 / высокая уверенность в воспроизведении, средняя в недокументированной error policy: refresh consumer failure оставляет остаток очереди без drain

- Минимум: maxBatchSize=1, queued rows a,b,c; refresh callback для a throws. Producer прекращает работу.
- Фактически a уже удалена из pending map; b,c остаются без назначенного frame, даже если причина ошибки устранена. Следующий **manual** flush возобновляет b,c. Для них ошибка a не является необходимой зависимостью.
- Причина: [consumer call и instrumentation](../../../packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher.ts#L155) стоят перед единственным reschedule, без finally.
- Важное различие: автоматическое повторение failed batch не обещано и не требуется этим finding; подтверждён именно stranded остаток. Это advanced helper reproduction; browser app reachability не подтверждена.
- Исправление: обеспечить reschedule оставшейся работы в finally; сохранить видимость ошибки и определить судьбу failed chunk без бесконечного retry. Семантику callback exceptions описать явно.
- Регрессия: consumer/onBatchFlush failure при частичном flush, producer stopped; несвязанный остаток дренируется после устранения причины.

### F08 — P2 / высокая уверенность: Core RAF scheduler начинает следующий callback после dispose во время drain

- Минимум: schedule normal callback A, вызывающий `scheduler.dispose()`; schedule normal callback B с наблюдаемым эффектом; `scheduler.flush()`.
- Фактически B всё равно начинается. Это не продолжение уже вошедшего A и не новый вызов schedule после teardown: B был принят ранее, но не начал выполняться. Новый schedule после dispose правильно возвращает -1.
- Причина: [runQueue](../../../packages/datagrid-core/src/runtime/rafScheduler.ts#L74) снимает `entries = Array.from(tasks.values())`, очищает map и затем исполняет detached массив без повторной terminal проверки. [Dispose](../../../packages/datagrid-core/src/runtime/rafScheduler.ts#L130) очищает maps, но не этот массив.
- Исправление: проверять terminal state перед началом каждого следующего detached task. Already-entered callback не прерывается. Сохранить существующую error isolation и приоритеты.
- Регрессия: teardown в первом callback не допускает второй в том же priority batch; остальные priority queues также не исполняются. Подтверждено непосредственно на Core scheduler; конкретный Vue unmount из середины viewport RAF callback отдельно не воспроизводился.

## Contract gap, а не новый доказанный app-flow дефект

**G01 — compute transport не имеет terminal dispatch guard.** `transport.dispose(); transport.dispatch({kind:'refresh'})` отправляет новое сообщение и создаёт timeout, хотя ACK listener уже удалён. [Dispatch/dispose](../../../packages/datagrid-worker/src/postMessageTransport.ts#L137) не используют disposed flag. Поведение подтверждено fake timers, но допустимый app-flow, который после terminal teardown повторно вызывает transport, не воспроизведён; lifecycle misuse нельзя автоматически приравнять к F03/F04. Минимальное усиление: определить terminal no-op/rejection/fallback policy, исключить новые postMessage/timers после cleanup. Не выполнять compute fallback на уже disposed модели.

## Измеренная нагрузка и пределы

### Детерминированные сценарии

| Сценарий | Реально выполнено | Наблюдение |
| --- | --- | --- |
| Foreground viewport burst | 1000 ranges, initialTotal=20 000, deferred pulls | 2 transport calls: исходный и последний; старый aborted, остальные intent coalesced. Поздний старый результат не заменяет последний |
| Paused viewport burst | 1000 ranges, flush, resume | До flush 0 calls; flush вызывает последний диапазон один раз и восстанавливает pause; resume затем снимает pause |
| Query changes при незавершённых pulls | 100 sort changes, transport намеренно игнорирует abort | 100 физически незавершённых запросов, 99 aborted signals, один logical lane; последний response остаётся актуальным после доставки 99 старых |
| Optimistic burst | 500 accepted writes одного rowId, первый commit gated; pull processing paused | Только первый transport вызван до release; все 500 Promise pending; после release 500 FIFO commits, final value=500, loading=false. Pull pause не делает write pause, pull flush не ждёт commits |
| Устойчивая перегрузка | 20 управляемых интервалов по 20 ms: producer 10 writes, consumer 1 completion за интервал | 200 accepted за 400 **виртуальных** ms; backlog 9,18,…,180; после остановки producer drain ещё 3600 виртуальных ms; max start age 3600 ms. Это заданное соотношение скоростей, не измеренная пропускная способность сервера |
| Ошибка optimistic commit | first rejects, second succeeds | Promise outcomes rejected/fulfilled; второй commit стартует, final value=2, loading=false |
| Exclusive FIFO + error | 1000 callbacks за одним gate, одна intentional rejection | Все 1000 выполняются в порядке, 1 rejection, whenIdle завершается и busy=false |
| Refresh cell dedupe | 1000 invalidations на 100 cells, maxBatchSize=10 | 1 initial frame; 100 deliveries за 10 frames, без потери unique dirty cells |
| Visible rows sync | 1000 invalidations перед одним injected frame | 1 frame, прочитан последний вход=999, pending frame отменён dispose |
| Datasource push | 1000 upsert, включая pull pause | 1000 synchronous model notifications, final value=1000; unsubscribe ровно один раз; late push после dispose не воскрешает cache |
| Медленный poll | request held на 10 000 fake ms при interval=250 | Один transport request, interval ticks не накапливаются; pending снимается после результата |
| Compute message burst | 1000 dispatch без ACK | 32 posted, 968 `handled:false` для sync fallback; после 100 fake ms 32 timedOut и metadata inflight=0 |
| Compute timeout циклы | 10×32 requests, 100 fake ms между batches, transport не дренируется | Всего posted=320, при этом metadata inflight=0 после последнего timeout. ACK cap не ограничивает физическую недоставленную очередь |
| Worker command sustained producer | 1000 patches в отдельных microtask turns, контролируемый consumer остановлен | Mailbox 250/500/750/1000 сообщений; localQueuePeak=1. После pump все применены, final value=1000 |

Нет случайных seeds: перечисленные последовательности и counts фиксированы. Async correctness использует deferred Promise, fake timers и явную доставку frames/messages; wall-clock sleep не используется.

### Настоящий браузер: latency под compute и streaming

Одна warm-up серия и 5 измерений для каждой пары shape/workload; median и min/max, **без p95/p99**. У local workload 12 displayed columns, две зависимые формулы, сортировка, 120 patch операций над r0. `burst` — один JS producer turn; `exclusive` — 120 отдельных serial callbacks с теми же patches. Streaming — 120 datasource upsert в реальном Vue grid без клиентских формул/сортировки, поэтому это другая работа.

Нативный keydown вводится CDP в отдельную кнопку страницы. Input delay — `handler performance.now() - event.timeStamp`; это задержка main-thread delivery, не полная latency навигации/редактирования внутри grid. Long tasks измерены PerformanceObserver отдельно.

| Rows | Workload | Mutation median, ms (range) | Settled median, ms | Input delay median, ms (range) | Long task max, ms |
| --- | --- | --- | --- | --- | --- |
| 1000 | 120 patch burst | 19.3 (15.6–23.2) | 30.0 | 23.4 (19.2–27.1) | Нет |
| 1000 | 120 exclusive callbacks | 294.8 (271.6–320.9) | 297.9 | 295.3 (272.2–321.1) | 320 |
| 1000 | 120 datasource push | 2.3 (2.1–2.9) | 29.8 | 5.4 (3.7–5.7) | Нет |
| 20 000 | 120 patch burst | 360.6 (351.8–433.4) | 367.1 | 363.9 (354.8–436.9) | 436 |
| 20 000 | 120 exclusive callbacks | 650.5 (633.5–680.5) | 653.6 | 650.6 (634.5–680.6) | 680 |
| 20 000 | 120 datasource push | 2.9 (2.6–3.2) | 31.4 | 6.7 (6.0–7.3) | Нет |

**O01 — измеренное ограничение отзывчивости, не потеря данных.** `await` внутри [exclusive Promise chain](../../../packages/datagrid-core/src/core/gridApiLifecycleRuntime.ts#L50) допускает Vue microtask reconciliation между операциями, но не уступает input/paint до конца microtask sequence. В отдельных counted runs на 1000 rows одинаковые 120 patches дали `getSnapshot`: **756 → 9681**, `getRow`: **138 → 8349**. `getRowsInRange` остался **1 → 1**, DOM mutation delivery **1 → 1**. Следовательно, это не доказательство 120 полных materializations или 120 DOM repaint; доказаны дополнительные reads/reconciliation и длинный непрерывный task. На больших sync compute CPU сам блокирует main thread. Точная стоимость всех watcher callbacks отдельно CPU-profile не атрибутировалась.

**O02 — latest activation корректна, но первоначальные reveals не coalesced.** В реальном Vue 200 одновременных requests дали 199 `cancelled:superseded`, последняя `activated` с logical rowId r19; завершение 167.9 ms. Немедленный unmount дал 200 `cancelled:disposed`, 150.1 ms, без pending операций. В отдельном counted run 1/20/200 activation requests сделали 1/19/190 scrollTop writes и 2/6/60 geometry reads. Первоначальный [reveal до первого await](../../../packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts#L4129) выполняется даже у почти всех затем superseded requests. Это измеренная лишняя работа при latest-intent burst; неправильная окончательная selection не обнаружена.

### Память и отсутствие admission limit

В production browser удержан первый exclusive callback, затем приняты callbacks с одинаковым payload shape — массив 128 чисел в closure. Promises отдельных queued callbacks потребителем не сохранялись. Перед каждой точкой вызван CDP `HeapProfiler.collectGarbage` **только как диагностический инструмент**.

| Принятых, ещё не выполненных callbacks | JSHeapUsedSize, bytes |
| --- | --- |
| 0 | 15 502 884 |
| 1000 | 16 377 928 |
| 5000 | 19 850 820 |
| 10 000 | 24 202 740 |
| После drain всех 10 000 | 15 522 616 |

Очередь выросла примерно на 8.30 MiB; после drain heap оказался на 19.3 KiB выше исходного. Это **намеренное удержание принятой очереди без лимита**, не доказанная утечка. При продолжающемся producer plateau не предусмотрено. Универсальный размер объекта/ячейки из этих цифр не следует. Подробные raw samples и timings — в [JSON](./202610/datagrid-overload-results.json).

## Риски и границы, не превращённые в новые дефекты

1. **R01 — optimistic/lifecycle admission не ограничен.** Рост доказан: 180 ожидающих commits в controlled overload и 10 000 retained lifecycle callbacks в браузере. Это не разрешает silently drop принятую запись. Текущий безопасный consumer control — await соответствующий write или ограниченный producer concurrency. Capacity/explicit refusal policy потребует отдельного решения до optimistic publication.
2. **R02 — worker local flush не является downstream backpressure.** Local queuePeak=1 сочетался с 1000 posted messages. Timeout освобождает ACK bookkeeping, но не удаляет уже отправленную работу. Browser Worker heap, mailbox age и аппаратная throughput граница непосредственно не измерены; рост подтверждён контролируемым transport, использующим настоящий facade и host.
3. **R03 — hung или abort-ignoring transport.** Уже ожидающий `flush()` остаётся pending после dispose, если его awaited pull никогда не settles. В репро это видно после 100 microtask turns; освобождение gate завершает barrier. [Drain loop](../../../packages/datagrid-core/src/models/server/dataSourcePullSchedulingRuntime.ts#L80) проверяет disposal только между awaits. Поскольку transport намеренно нарушает cooperative abort, это условный liveness gap, а не новый дефект нормального pull contract. Нужна ясность, требует ли local cancellation немедленно завершать barrier независимо от transport; transport timeout и локальное settlement не останавливают внешнюю сеть автоматически.
4. **R04 — write lane зависит от transport и иногда projection refresh.** Commit может ждать authoritative refresh перед освобождением serial lane. Без timeout/cancellation в конкретном transport зависание блокирует следующие commits. Подтверждён FIFO gate growth; отдельный browser/backend timeout/fill/history stress не проводился.
5. **R05 — observers не покрывают всё.** Pull counters показывают logical lanes, а не abandoned physical requests. Compute ACK stats не равны completion гарантии модели. Worker-owned mutations не имеют per-command public Promise/barrier. Отсутствие этого API отмечено как observation/documentation gap; новое API в аудите не добавлялось.
6. **R06 — WebSocket network admission не проверен.** Application onmessage синхронен; persistent network producer способен наполнять browser-owned очередь. Реальный WebSocket soak/flow-control и WebSocket heap не измерены. Нельзя выводить browser streaming memory safety из unit test.
7. **R07 — arbitrary callback fairness.** Ни один общий scheduler не может безопасно прервать уже исполняемый произвольный sync callback, сохранив его atomic semantics. Внутренние RAF/frame budgets не являются browser time preemption. Infinite/reentrant producers, nested await той же exclusive queue и неидемпотентные side-effect compute callbacks не включались как допустимые benchmark workloads.

## Минимальный порядок исправлений с сохранением семантики

1. **Worker correctness — F01/F02.** Убрать cross-barrier coalescing и независимую потерю definitions; сначала получить согласованные authoritative state/proxy/delta, затем любые worker throughput изменения.
2. **Terminal ownership — F03/F04/F08.** Закрыть dequeue после dispose в текущих owners; явно завершать несостоявшиеся accepted operations; не объявлять уже отправленный server commit отменённым или успешным вопреки его реальному результату. Укрепить G01 отдельно, без fallback в disposed Core.
3. **Producer generation — F05.** Сделать request-owned cleanup poller; сохранить single-flight, пропуск interval ticks и existing retry semantics.
4. **Refresh liveness — F06/F07.** Исправить handle accounting и reschedule в существующем batcher; определить error policy failed chunk. Никаких общих новых managers.
5. **Scheduling/resource policy — R01/R02/O01/O02, отдельная миграция.** Сначала определить admission/refusal/observability для lossless FIFO writes и worker credit, затем cooperative yielding **между** самостоятельными exclusive задачами с сохранением FIFO/barrier. Для данных применять только уже объявленный batching contract. Для refresh допустимы union dirty cells и latest sample; для activation — coalescing ещё не исполненного reveal при сохранении explicit cancelled results. Server commits, formula registrations и произвольные business callbacks нельзя заменять последним сообщением.

## Воспроизведение и ограничения проверки

Команды и параметры находятся в [harness README](../../../scripts/audits/datagrid-overload/README.md). Source diagnostics, raw browser observations, median/range и исходный dirty baseline сохранены в репозитории. Сборка fixture прошла; Vite предупредил о размере diagnostic bundle, это не build failure.

Аудит не выполнял full monorepo tests, package release/tarball checks, hardware mobile testing, renderer parity всех адаптеров, реальный HTTP/WS server flood, настоящий browser-worker heap/latency stress, длительный multi-hour soak или heap retained-path snapshots. Browser GC admission experiment не является отдельным повторением memory-safety аудита. Input delay относится к доставке реального события браузером; full editor/clipboard/navigation UX под нагрузкой этим числом не сертифицирован. Пять samples не являются release performance budget.

Найденные проблемы открыты; реализации fixes и product regression assertions с правильным ожидаемым поведением — следующий отдельный шаг.
