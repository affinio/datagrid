### Slice 1: Atomic Saved View + Server Query Reset

  Package prompt

  Нужно закрыть архитектурный gap в datagrid packages: backend-backed rowModel consumers не должны вручную делать pauseBackpressure/applySavedView/reset viewport/RAF/
  flushBackpressure.

  Контекст:
  - В consumer app сейчас есть workaround вида applySavedView(..., { applyViewport: false }) + rowModel.pauseBackpressure() + manual setViewportRange({0..N}) +
  nextTick/requestAnimationFrame + flushBackpressure().
  - Нужно пакетное API, которое атомарно применяет saved view/query state для DataSourceBackedRowModel без промежуточных pulls и с корректным reset viewport на sort/
  filter/group/pivot/aggregation changes.

  Задача:
  1. Проанализируй текущие DataGrid saved-view, state-persistence, DataSourceBackedRowModel backpressure/viewport APIs.
  2. Спроектируй минимальный public API без ломки существующих consumers.
  3. Реализуй пакетный helper/API для atomic saved-view application.
  4. Покрой contract tests: no intermediate pull, viewport reset range applied once, backpressure resumes/flushed, saved view still applies column/filter/sort state.
  5. Обнови docs/types exports если нужно.

  Ограничения:
  - Не делать широкий refactor.
  - API должен быть production-shaped для backend row model.
  - Сохранять backward compatibility.

  Validation:
  - targeted unit/contract tests for datagrid-core/datagrid-vue/datagrid-vue-app.
  - package type-check.

  App prompt

  Пакет обновлен и теперь поддерживает atomic saved-view/server-query apply.

  В app убери workaround-и вокруг saved view:
  - applyGridSavedViewWithoutIntermediatePulls
  - manual pauseBackpressure/resume/flush
  - manual nextTick/requestAnimationFrame choreography
  - resetCatalogServerViewportOnQueryChange / scheduleCatalogViewportRecovery если заменяются пакетным API

  Используй новый package API для применения saved view/preset grid_view так, чтобы:
  - sort/filter/group changes reset server viewport корректно
  - нет промежуточных pulls
  - сохранение/применение preset продолжает работать
  - viewport/query dimming поведение не ломается

  Добавь/обнови app-level smoke/unit tests если есть test harness.
  Validation: type-check/build app.

  ———

  ### Slice 2: External Row Patch / Upsert For Server Push

  Package prompt

  Нужно закрыть gap для server push / polling updates в backend-backed DataGrid.

  Контекст:
  - Consumer app сейчас обновляет строки через api.rows.applyEdits(..., { emit:false, reapply:false }) и suppress-флаги, чтобы не запускать user edit/history/commit
  pipeline.
  - Это должно быть пакетным explicit API: external row patch/upsert для DataSourceBackedRowModel/DataGrid API.

  Задача:
  1. Найди текущие patchRows/applyEdits/dataSource push paths.
  2. Добавь публичный API для external updates:
     - update existing loaded rows by rowId
     - optionally upsert rows with known index/range if datasource event gives it
     - not emit cell-change/user edit events
     - not record history
     - preserve row cache/projection consistency
     - support recompute strategy where needed
  3. Если существующий DataGridDataSource.subscribe already intended for this, formalize and expose the right consumer path.
  4. Add contract tests for silent external update, row cache update, no commitEdits call, no history/cell-change emission.

  Validation:
  - datagrid-core/datagrid-vue tests + type-check.

  App prompt

  Пакет обновлен и теперь есть explicit external row patch/upsert API.

  В app замени локальный workaround:
  - patchGridRowsInDataGrid
  - suppressGridCellChangeDepth
  - suppressGridCommitEditsDepth для external updates
  - manual api.rows.applyEdits(... emit:false/reapply:false)

  На новый package API.

  Сохрани поведение:
  - live/poll updates обновляют уже загруженные строки
  - optimistic edit rollback работает
  - selectedLot/selectedWorkspace sync не ломается
  - user edits still go through commitEdits/history

  Validation:
  - app type-check/build
  - targeted manual/smoke path: edit cell, receive external row update, conflict rollback.

  ———

  ### Slice 3: Focus / Selection Anchor API

  Package prompt

  Нужно вынести focus restoration из consumer app в datagrid package.

  Контекст:
  - Consumer app сейчас вручную ищет DOM через .affino-datagrid-app-root и .grid-cell[data-row-id], сохраняет selection snapshot, remap rowId, делает nested
  requestAnimationFrame и focus({ preventScroll }).
  - Это нужно как public API для side panels/detail panes and async refresh flows.

  Задача:
  1. Проанализируй текущие focus/selection APIs DataGridExposed/getApi.
  2. Добавь public API:
     - captureFocusAnchor(options?)
     - restoreFocusAnchor(anchor, options?)
     - anchor должен хранить rowId/logical row id + columnKey/columnIndex + selection snapshot when available
     - restore должен работать после virtualization/refetch/re-render
     - no unwanted scroll unless explicitly requested
  3. Покрой tests: focused cell restored after rerender, selection snapshot restored, row missing handled gracefully, preventScroll respected.

  Validation:
  - datagrid-vue/datagrid-vue-app tests + type-check.

  App prompt

  Пакет обновлен и теперь есть public focus anchor API.

  В app удали локальные DOM helpers:
  - getGridRootElement
  - escapeGridSelectorValue
  - captureGridFocusAnchor
  - remapGridSelectionSnapshot
  - findGridFocusTarget
  - focusGridElement
  - restoreGridFocus / nested RAF logic

  Замени на package capture/restore focus anchor API.

  Сохрани сценарии:
  - opening detail pane captures grid focus
  - closing/refreshing detail restores focus/selection
  - row may be refetched/recreated
  - no viewport jump on restore

  Validation:
  - app type-check/build
  - manual smoke: open lot details, refresh details, close, focus returns to same grid cell.

  ———

  ### Slice 4: Filter Snapshot Normalization Hooks

  Package prompt

  Нужно убрать необходимость consumer app вручную мутировать DataGridFilterSnapshot.

  Контекст:
  - App sanitizes filter snapshot:
    - removes unsupported valueSet filters for columns without backend histogram/value support
    - normalizes percent input from UI percent into decimal backend value
    - walks columnFilters/advancedFilters/advancedExpression manually
  - Это должно быть supported through package-level filter serialization/normalization hooks.

  Задача:
  1. Найди filter model pipeline: column filters, advanced filters, saved view persistence, datasource pull filterModel.
  2. Добавь per-column hooks/options:
     - filterValueParser / filterValueSerializer or backendFilterValueMapper
     - ability to disable valueSet filter mode for a column cleanly
     - saved-view migration/normalization before persistence and before datasource pull
  3. Ensure advanced filters and advancedExpression use same normalization path.
  4. Add contract tests for percent column and unsupported valueSet filter.

  Validation:
  - datagrid-vue-app/datagrid-core relevant tests + type-check.

  App prompt

  Пакет обновлен и поддерживает filter normalization hooks.

  В app перенеси логику:
  - PERCENT_FILTER_COLUMN_KEYS percent /100 normalization
  - VALUE_FILTER_COLUMN_KEYS stripping unsupported valueSet
  - sanitizeGridValueSetFilters
  - sanitizePercentAdvancedFilters
  - sanitizePercentAdvancedExpression

  В column config / package hooks.

  Сохрани:
  - backend получает decimal for ROI/discount
  - valueSet остается только для разрешенных columns
  - saved presets/grid_view продолжают мигрировать старые snapshots

  Validation:
  - app type-check/build
  - smoke: apply percent filter, save preset, reload/apply preset.

  ———

  ### Slice 5: Type Ergonomics For Columns/Menu

  Package prompt

  Нужно убрать unsafe casts в consumer app вокруг DataGrid column/menu props.

  Контекст:
  - App вынужден делать:
    - typedColumns as unknown as DataGridAppColumnInput[]
    - columnMenuOptions as unknown as DataGridColumnMenuProp
  - Это значит public generics/types неудобны или несовместимы с valid config.

  Задача:
  1. Найди причины casts в DataGridAppColumnInput and DataGridColumnMenuProp.
  2. Улучши generic inference / exported helper types without breaking existing API.
  3. Если нужен helper, добавь defineDataGridColumns<TRow>() / defineDataGridColumnMenu<TRow>().
  4. Add type tests or tsd-style contract tests showing consumer config compiles without unknown casts.

  Validation:
  - package type-check
  - public API type-check tests.

  App prompt

  Пакет обновлен для type-safe columns/menu config.

  В app убери:
  - typedColumns as unknown as DataGridAppColumnInput[]
  - columnMenuOptions as unknown as DataGridColumnMenuProp

  Используй новый typed helper/generic API.

  Acceptance:
  - no `as unknown as` для datagrid columns/menu
  - type-check passes
  - runtime behavior unchanged.

  ———

  Я бы запускал в таком порядке: Slice 1 → Slice 2 → Slice 3 → Slice 4 → Slice 5. Первые два дадут максимальное снижение хрупкости backend-backed сценария.
