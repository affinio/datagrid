Формулировка: это должен быть semantic viewport state, а DOM-scroll должен остаться внутренней реализацией adapter/viewport-controller.

  Целевой API

  api.view.getViewportPosition(): DataGridViewportPositionSnapshot | null

  api.view.setViewportPosition(
    position: DataGridViewportPositionSnapshot,
    options?: DataGridSetViewportPositionOptions,
  ): void

  api.view.scrollToCell({
    rowId?: DataGridRowId
    rowIndex?: number
    columnKey?: string
    columnIndex?: number
    align?: "start" | "center" | "nearest"
  }): void

  И opt-in интеграция в unified state:

  const state = api.state.get({ includeViewportPosition: true })

  api.state.set(state, {
    applyViewport: true,
    applyViewportPosition: true,
  })

  Тип состояния

  interface DataGridViewportPositionSnapshot {
    version: 1
    range: DataGridViewportRange
    anchor: {
      rowId: DataGridRowId | null
      rowIndex: number | null
      columnKey: string | null
      columnIndex: number | null
    } | null
    scroll: {
      top: number
      left: number
    } | null
  }

  При restore порядок такой:

  1. применить sort/filter/group/pivot/pagination
  2. применить columns layout: order/visibility/width/pin
  3. применить selection anchor
  4. восстановить viewport position
  5. если rowId/columnKey не резолвятся, fallback на rowIndex/columnIndex
  6. если семантический anchor не резолвится, fallback на scroll.top/left

  Архитектурное правило

  datagrid-core должен владеть контрактом и headless state shape, но не DOM.
  viewport controller должен уметь читать/ставить фактический scroll.
  datagrid-vue/app связывает DOM viewport с public API.

  Слайсы

  1. [] datagrid-core: добавить public types и методы в DataGridApiViewNamespace.
     Без DOM, только контракт и optional capability binding. Если capability отсутствует, getViewportPosition() возвращает null, setViewportPosition() no-op
     или strict error через state options.
  2. [] datagrid-core: расширить api.state.get/set.
     Добавить DataGridGetStateOptions, applyViewportPosition?: boolean, optional view.viewportPosition. Не трогать существующий rows.snapshot.viewportRange.
  3. [] datagrid-core/viewport: добавить controller bridge.
     Реализовать чтение из getIntegrationSnapshot() / getViewportSyncState() и команды scrollToRow, scrollToColumn, scrollToCell.
  4. [] datagrid-orchestration: пробросить capability в runtime service.
     Runtime должен отдавать/принимать semantic position без прямого доступа пользователя к DOM.
  5. [] datagrid-vue: подключить capability в app/runtime layer.
     Здесь DOM scroll допустим как внутренняя реализация, но не как публичный контракт.
  6. [] Тесты.
     Минимум: core state roundtrip, fallback behavior, columnKey after reorder, hidden column fallback, selection anchor preservation, viewport controller
     scroll restoration.
  7. [] Docs.
     Короткий раздел: “Persisting sort, selection, and viewport position”, с примером через api.state.get({ includeViewportPosition: true }).

  Я бы начинал с API/type slice и теста на state roundtrip, без Vue. Это зафиксирует контракт до реализации DOM-моста.