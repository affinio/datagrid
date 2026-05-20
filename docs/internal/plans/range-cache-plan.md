Status as of `2026-05-20`: implemented for the current flat `createDataSourceBackedRowModel` path. The code now has `rangeCache`, placeholder rows, stale-row retention, retry/error handling, invalidation paths, velocity-aware prefetch/overscan helpers, and browser/perf gates for blank viewport and placeholder exposure. This document remains useful as historical slice notes, but the open work has moved to enterprise server projection/live/offline capabilities rather than basic blank-viewport range loading.

Open follow-up:

- Promote or tune hardware-specific performance thresholds from real devices.
- Keep server grouping/tree/pivot/hierarchical-store work separate from this flat range-cache path.
- Avoid public loading-row API expansion unless a product use case needs cell-renderer-visible loading state.

• План

  1. Зафиксировать целевое поведение
      - Быстрый scroll не должен показывать белые пустоты.
      - Недогруженные строки отображаются как стабильные placeholders/skeleton rows.
      - Промежуточные range-запросы при резком scroll можно пропускать.
      - Последняя видимая область всегда имеет приоритет.
  2. Аудит текущей backend-модели
      - Где считается visible range.
      - Как устроен overscan.
      - Есть ли cache range/rows.
      - Как обрабатываются устаревшие ответы.
      - Где сейчас появляется “пустота”: render layer, datasource layer или scheduler.
  3. Ввести внутренний RangeCache
      - Хранить данные чанками, например chunkSize = 200/500.
      - Состояния чанка: missing, loading, loaded, error.
      - Дедуплицировать in-flight запросы.
      - Игнорировать ответы для старой revision/sort/filter state.
      - Ограничить память LRU-эвикшеном.
  4. Добавить request scheduler
      - Coalesce scroll events через requestAnimationFrame.
      - Запрашивать только актуальный target range.
      - При быстром scroll отменять или помечать obsolete старые запросы.
      - Приоритеты:
          - visible viewport;
          - overscan по направлению движения;
          - противоположная сторона;
          - background prefetch.
  5. Velocity-aware overscan
      - Overscan считать не константой, а от скорости scroll и latency backend-а.
      - Примерно:

     overscanRows = baseRows + scrollVelocityRowsPerMs * expectedLoadMs
      - Для экстремального scroll ставить верхний cap, чтобы не DDOSить backend.

  6. Рендерить loading rows вместо пустот
      - Grid layout должен оставаться стабильным.
      - Недоступные строки получают placeholder-модель.
      - Ячейки могут показывать skeleton или muted loading state.
      - Не менять высоты строк во время загрузки.
  7. Backend contract
      - Нужна стабильная revision/snapshot модель.
      - Запросы должны быть range-based:

     getRows({
       start,
       count,
       sort,
       filter,
       revision
     })
      - Если это меняет public API, сначала отдельно согласовать API.

  8. Интеграция в sandbox/demo
      - Сделать production-shaped demo с искусственной latency.
      - Проверить сценарии:
          - резкий wheel scroll;
          - drag scrollbar thumb;
          - jump на 100k+ строк;
          - смена sort/filter во время загрузки;
          - медленный backend;
          - ошибки чанков.
  9. Валидация
      - Unit tests для RangeCache.
      - Tests для obsolete responses.
      - Tests для velocity overscan.
      - Type-check/build пакета datagrid.
      - Визуальная проверка sandbox: при экстремальном scroll нет белого экрана.

  Предлагаемый первый slice

  Сначала без изменения public API: добавить внутренний RangeCache + loading row state, подключить его к backend datasource и sandbox demo. Это даст видимый UX-
  эффект и покажет, нужен ли потом новый публичный datasource contract.

   Slice 1: Аудит backend loading path

  Аудит текущей backend-модели DataGrid для проблемы пустот при экстремально быстром scroll.

  Задача:
  - Найди, где считается visible range / overscan.
  - Найди, где backend datasource запрашивает rows/ranges.
  - Найди, как хранятся загруженные rows и in-flight requests.
  - Найди, где renderer получает отсутствие данных и почему появляются пустоты.
  - Не меняй код.

  Вывод:
  1. Краткая схема текущего flow.
  2. Конкретные файлы/модули, которые нужно менять.
  3. Минимальный первый implementation slice.
  4. Риски для public API.

  Slice 2: RangeCache design

  Спроектируй внутренний RangeCache/ChunkCache для backend datasource DataGrid.

  Ограничения:
  - Не менять public API без отдельного согласования.
  - Chunk-based cache: chunkSize configurable internally.
  - Состояния чанков: missing/loading/loaded/error.
  - Dedupe in-flight requests.
  - Ignore stale responses after sort/filter/revision change.
  - LRU или bounded cache для памяти.
  - Поддержка lookup row by absolute index.

  Вывод:
  1. Предложи TypeScript интерфейсы.
  2. Укажи, в какой пакет/модуль их положить.
  3. Опиши интеграцию с текущим datasource flow.
  4. Не реализуй код, если API затрагивает public surface.

  Slice 3: Implement internal RangeCache

  Реализуй внутренний RangeCache/ChunkCache для backend loading path.

  Требования:
  - Держи изменения локальными в datagrid/backend datasource layer.
  - Не меняй public API.
  - Chunk states: missing/loading/loaded/error.
  - Dedupe in-flight chunk loads.
  - Ignore stale responses using generation/revision token.
  - Provide read API that returns loaded rows and loading placeholders metadata.
  - Add focused unit tests for:
    - chunk calculation;
    - in-flight dedupe;
    - stale response ignore;
    - partial loaded range read;
    - cache reset on datasource state change.

  После реализации:
  - Запусти smallest relevant tests/type-check.
  - Финальный ответ строго:
    1. Status
    2. Validation run
    3. Unresolved issues
    4. Suggested commit message

  Slice 4: Scheduler + coalescing

  Добавь scheduler для backend range loading при scroll.

  Требования:
  - Coalesce rapid scroll/range updates через requestAnimationFrame или существующий scheduler проекта.
  - Последний visible range имеет приоритет.
  - Не грузить все промежуточные ranges при экстремально быстром scroll.
  - Dedupe requests через RangeCache.
  - Старые responses не должны перетирать актуальное состояние.
  - Не менять public API.

  Проверь:
  - Быстрый scroll вызывает ограниченное число backend range loads.
  - Последний viewport запрашивается первым.
  - Intermediate ranges skipped/coalesced.

  Добавь focused tests там, где уже принято тестировать scheduler/loading behavior.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 5: Velocity-aware overscan

  Добавь velocity-aware overscan для backend datasource mode.

  Требования:
  - Overscan зависит от скорости scroll в rows/ms и ожидаемой latency.
  - Есть min/base overscan и max cap.
  - Overscan асимметричный: больше по направлению движения, меньше назад.
  - При неизвестной скорости использовать текущий/default overscan.
  - Не ломать existing static overscan behavior для non-backend/local mode.
  - Не менять public API, если можно оставить internal constants/config.

  Добавь tests:
  - медленный scroll дает base overscan;
  - быстрый scroll увеличивает overscan;
  - direction вниз/вверх влияет на распределение;
  - max cap соблюдается.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 6: Loading row rendering

  Убери визуальные пустоты при отсутствующих backend rows.

  Требования:
  - Если row data еще не loaded, renderer должен получать стабильный loading row/cell state.
  - Не менять row height во время loading.
  - Не показывать белый gap/empty viewport.
  - Loading UI должен быть нейтральным и дешевым по render cost.
  - Не ломать keyboard navigation, selection, row index calculations.
  - Не менять public API без согласования.

  Проверь сценарии:
  - viewport полностью missing;
  - частично loaded range;
  - быстрый jump далеко вниз;
  - loaded rows заменяют placeholders без layout shift.

  Добавь focused tests или demo validation в существующем стиле проекта.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 7: Error and retry states

  Добавь обработку error chunks для backend RangeCache.

  Требования:
  - Chunk state error не должен ломать весь grid.
  - Visible error rows/cells должны иметь стабильный fallback state.
  - Должен быть внутренний retry mechanism при повторном попадании range в viewport или явный retry, если такой паттерн уже есть.
  - Не менять public API без согласования.
  - Ошибки старой generation/revision игнорировать.

  Tests:
  - failed chunk gets error state;
  - retry переводит error -> loading -> loaded;
  - stale failed response не портит новый cache generation;
  - соседние loaded chunks продолжают отображаться.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 8: Sandbox latency demo

  Обнови sandbox/server-demo для production-shaped демонстрации backend scroll loading.

  Требования:
  - Большой dataset, например 100k+ rows.
  - Искусственная latency и jitter.
  - Возможность быстро scroll/jump.
  - Видно, что missing rows отображаются как loading placeholders, а не белые пустоты.
  - Не делать toy demo отдельно от текущего backend datasource flow.
  - Не менять core public API.

  Validation:
  - Запусти package-level build/type-check.
  - Если есть dev server, проверь что demo стартует.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 9: Regression tests

  Добавь regression coverage для backend scrolling без пустот.

  Сценарии:
  - rapid scroll coalesces intermediate ranges;
  - final viewport gets requested;
  - missing rows render loading state;
  - stale responses ignored after sort/filter/revision reset;
  - partial cache hit does not refetch loaded chunks;
  - cache cap/LRU does not evict visible chunks.

  Ограничения:
  - Не переписывать test infrastructure.
  - Использовать существующие test helpers.
  - Не менять production code, кроме минимальных testability hooks, если без них невозможно.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message

  Slice 10: Final hardening

  Проведи финальный hardening backend scroll loading после внедрения RangeCache/scheduler/placeholders.

  Проверь:
  - TypeScript public/private boundaries.
  - Нет accidental public API changes.
  - Нет лишних rerenders на scroll.
  - Нет memory leak в in-flight requests/cache.
  - Sort/filter reset очищает cache корректно.
  - Selection/keyboard navigation не ломаются на loading rows.
  - Backend errors не приводят к белому viewport.
  - Sandbox показывает поведение при latency/jitter.

  Разрешено:
  - Малые исправления.
  - Таргетированные тесты.
  - Локальная оптимизация горячих мест.

  Запрещено:
  - Большие refactors.
  - Изменение public API без согласования.

  Финальный ответ строго:
  1. Status
  2. Validation run
  3. Unresolved issues
  4. Suggested commit message


  • 1. Текущий flow

  - Viewport считает dynamic overscan по scroll velocity: packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts:534.
  - После пересчета range вызывает activeRowModel.setViewportRange(...): packages/datagrid-core/src/viewport/dataGridViewportController.ts:1675.
  - Backend datasource model делает pullRange(..., "viewport-change", "critical"): packages/datagrid-core/src/models/dataSourceBackedRowModel.ts:1818.
  - Данные кладутся в rowCache: Map<index, row>: packages/datagrid-core/src/models/dataSourceBackedRowModel.ts:363.
  - getRowsInRange() возвращает только cached rows и пропускает missing indices: packages/datagrid-core/src/models/dataSourceBackedRowModel.ts:1803.
  - Vue runtime для sparse model очищает текущий range и возвращает только реально найденные rows: packages/datagrid-vue/src/composables/
    useDataGridRuntime.ts:539.
  - Renderer получает короткий массив/пустой массив и коммитит его в displayRows: packages/datagrid-vue/src/app/useDataGridAppViewport.ts:1090.

  Итог: пустоты появляются не из-за scroll math, а потому что missing backend rows не представлены как стабильные placeholder rows.

  2. Модули для изменения

  - Core datasource cache/loading: packages/datagrid-core/src/models/dataSourceBackedRowModel.ts:297.
  - Datasource protocol, если позже понадобится public API для revision/snapshot или loading metadata: packages/datagrid-core/src/models/server/
    dataSourceProtocol.ts:95.
  - Viewport/model bridge mapping missing rows в renderable rows: packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts:528.
  - Vue sparse row sync, где сейчас missing rows выкидываются: packages/datagrid-vue/src/composables/useDataGridRuntime.ts:539.
  - App viewport commit path, где пустой result становится пустым viewport: packages/datagrid-vue/src/app/useDataGridAppViewport.ts:1096.

  3. Минимальный первый implementation slice

  Сделать internal-only изменение без public API:

  - В dataSourceBackedRowModel добавить внутренний статус missing/loading для индексов текущего viewport.
  - getRowsInRange() для sparse/server datasource должен возвращать row-like loading placeholders на missing indices, а не пропускать их.
  - Placeholder row должен иметь стабильный rowId, displayIndex, sourceIndex, kind: "leaf" и marker вроде internal __loading.
  - applyRows() должен заменять placeholder реальной строкой без layout shift.
  - Сохранить текущий pullRange, abort, stale requestId и prefetch logic как есть.

  Это самый короткий путь к UX-эффекту: убрать белые дыры без изменения backend contract.

  4. Риски public API

  - DataGridRowNode<T> сейчас не имеет loading-state поля, поэтому marker придется держать internal/structural-compatible.
  - Если exposing loading state нужно пользователю/cell renderer-ам, это уже public API change.
  - DataGridDataSourcePullRequest сейчас не несет explicit revision/snapshot token; есть только internal stateKey и result datasetVersion. Для строгой
    consistency позже потребуется отдельное API-предложение.
  - Placeholder rows могут повлиять на selection, keyboard navigation, editing и row id lookup, поэтому первый slice должен держать их read-only и явно
    отличимыми внутри runtime.
