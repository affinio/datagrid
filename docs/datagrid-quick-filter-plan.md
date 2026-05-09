# Quick filter plan

  ## [x] Slice 1: Контракт

  - Зафиксировать термин: quickFilter, не globalSearch.
  - Добавить в DataGridFilterSnapshot опциональное поле, например:
      - quickFilter?: { query: string; columns?: readonly string[]; mode?: "contains" | "tokens" }
  - Решить дефолт колонок:
      - только grid columns;
      - default: visible non-system grid columns;
      - capabilities.searchable?: boolean controls opt-in/out, filterable is not required.
  - Сразу определить server-side сериализацию через существующий filterModel.

  Validation:

  - type-check datagrid-pivot, datagrid-core.
  - snapshot clone/normalize tests.

  ## [x] Slice 2: Predicate Layer

  - Расширить создание filter predicate так, чтобы quick filter композился с column/advanced/style filters через AND.
  - Добавить нормализацию текста: trim, case-insensitive, locale-neutral по дефолту.
  - Не читать весь row object напрямую.
  - Использовать column field/accessor/readRowField.

  Validation:

  - unit tests:
      - query matches one column;
      - query matches multiple columns;
      - empty query не фильтрует;
      - column filter + quick filter работают вместе.

  ## [x] Slice 2.5 — Quick filter benchmarks

    Goal:
    Measure quickFilter performance before expanding public API/UI.

    Tasks:
    1. Add benchmark scenario for client row model:
    - 10k rows
    - 50k rows
    - 100k rows
    2. Measure:
    - first quick filter apply
    - query change
    - clear quick filter
    - quick filter + sort
    - quick filter + column filter
    3. Add budgets/baselines if existing benchmark system supports it.
    4. Compare:
    - no quickFilter
    - quickFilter on 1 searchable column
    - quickFilter on 5 searchable columns
    5. Ensure benchmark does not scan raw row object.
    6. Output metrics into existing benchmark report format.

    Validation:
    - Run targeted benchmark.
    - Run existing benchmark gate if affordable.
    - Run type-check.
    - git diff --check.
  
  ## [x] Slice 3: Projection Pipeline

  - Не добавлять новый stage.
  - Оставить quick filter внутри filter stage.
  - filterChanged должен инвалидировать filter -> sort -> group -> pivot -> aggregate -> paginate -> visible.
  - Проверить, что filteredRowIds используется группировкой/деревом корректно.

  Validation:

  - client row model tests:
      - rowCount меняется;
      - sorted rows считаются после quick filter;
      - group/tree behavior не ломается;
      - pagination пересчитывается после поиска.

  ## [x] Slice 4: Server/DataSource

  - Убедиться, что DataGridDataSourcePullRequest.filterModel уже несет quick filter.
  - Обновить normalize/serialization для server client/backend adapter.
  - Не добавлять отдельный search top-level field, если нет сильной причины.

  Validation:

  - datasource pull tests:
      - quick filter доходит до adapter;
      - projection hash/cache key меняется;
      - filter-change reason остается корректным.

  ## [x] Slice 5: Worker Parity

  - Прокинуть новый filter snapshot через worker protocol.
  - Проверить structured clone compatibility.
  - Не добавлять функций в snapshot.

  Validation:

  - worker parity tests:
      - client vs worker одинаковый row order/count;
      - quick filter + sort;
      - quick filter + column filter.

  ## [x] Slice 6: Public App/Vue Binding

  - Добавить controlled prop на app/facade уровне только после стабилизации core контракта.
  - Варианты:
      - либо пользователь меняет весь filterModel;
      - либо удобный quickFilter prop/emits, который внутри мержится в filterModel.
  - Я бы сначала предпочел filterModel-first, без отдельного публичного prop, чтобы не раздуть API.

  Validation:

  - Vue contract tests:
      - controlled filterModel;
      - clear quick filter;
      - no uncontrolled state drift.

  ## [x] Slice 7: Sandbox/Demo UI

  - Добавить простой input в controls.
  - Debounce только в UI, не в core.
  - Clear button.
  - Показать совместимость с column filters/sort/server datasource.

  Validation:

  - targeted sandbox/component tests, если есть.
  - ручная проверка client + server datasource demo.

  ## [x] Slice 8: Docs And Guardrails

  - Документировать:
      - quick filter является частью filterModel;
      - применяется до sort/group/pivot/pagination;
      - server datasource обязан интерпретировать его сам;
      - дефолтные searchable columns.
  - Добавить changelog.

## [x] Slice 9: API Contract

  - Добавить в app-layer типы quickFilter?: boolean | DataGridQuickFilterOptions.
  - Минимальные options: placeholder?, columns?, mode?.
  - Зафиксировать, что это только shell control поверх filterModel.quickFilter, не новый state channel.

## [x] Slice 10: App Toolbar Wiring

  - В DataGridDefaultRenderer добавить quick filter control рядом с advanced filter.
  - quickFilter={true} включает input.
  - Изменение input обновляет filterModel.quickFilter.
  - Clear удаляет quickFilter из snapshot.

## [x] Slice 11: Controlled FilterModel Compatibility

  - Проверить controlled/uncontrolled сценарии.
  - Если consumer передает filterModel, shell должен эмитить обычный update:state/filter change, без локального рассинхрона.
  - Не добавлять отдельный update:quickFilter.

## [x] Slice 12: Searchable Columns Resolution

  - Если quickFilter.columns не задан, app-layer резолвит дефолтные searchable columns.
  - Учитывать column.capabilities.searchable === false/true.
  - Не сканировать raw row object.

## [x] Slice 13: Vue Public Binding

  - Протащить prop через Vue wrapper/app component.
  - Поддержать декларативно:

    <DataGrid quick-filter advanced-filter />

  - Поддержать object form:

    <DataGrid :quick-filter="{ placeholder: 'Search accounts', mode: 'tokens' }" />

## [x] Slice 14: Sandbox Migration

  - Убрать ручной quick filter toolbar из sandbox cards.
  - Перевести sandbox на декларативный quick-filter.
  - Проверить client row model и server data source demo.

## [] Slice 15: Tests

  - Contract/app tests: input renders only when enabled.
  - Typing tests: boolean и object prop.
  - Behavior tests: typing updates filterModel.quickFilter, clear removes it.
  - Server datasource smoke: request still carries filterModel.quickFilter.

## [] Slice 16: Docs + Changelog

  - README пример рядом с advanced-filter.
  - Документировать, что это shell convenience API.
  - Отдельно указать, что controlled consumers могут продолжать управлять filterModel.quickFilter напрямую.


  ### Главное архитектурное правило: 
  quick filter должен быть частью фильтрационной модели и projection pipeline, но не становиться отдельным глобальным сервисом и не тащить UI в core.
