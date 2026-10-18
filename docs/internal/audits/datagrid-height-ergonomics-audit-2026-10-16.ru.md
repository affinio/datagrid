# DataGrid: удобство настройки высоты

Дата: 2026-10-16. Статус: внутреннее sizing упрощено; браузерная sizing матрица для fill, auto-height, inspector, pinned-bottom и Gantt проходит.
Проверены публичный API, runtime CSS, renderer, расчёт размеров и sizing contracts. Высота viewport измеряется обычным runtime путём; scroll ownership не менялся.

## Вывод

Упростить можно. Публичных режимов уже достаточно: `fill` и `auto-height`. Основная сложность была в повторном `height: 100%` на внутренних контейнерах, недостаточно явном контракте внешнего host и отсутствии onboarding примера высоты. Внутренние проценты убраны; `100%` остался на root как связь с выделенной host областью; документация теперь содержит bounded host recipe.

Рекомендуемый контракт для человека:

- Приложение выделяет таблице прямоугольник.
- DataGrid целиком занимает его, включая встроенный toolbar и inspector.
- Таблица сама распределяет это пространство между toolbar, заголовком, body и pinned rows.
- В режиме `auto-height` высота зависит от строк; `maxRows` ограничивает body и включает его внутреннюю прокрутку.

Пользователь не должен задавать высоту `.datagrid-app-workspace`, `.datagrid-app-stage` или `.grid-stage`, вычислять высоту toolbar либо знать число внутренних wrappers.

## Фактическая цепочка

Обычный renderer:

`host приложения → runtime root → layout → workspace → stage → grid-stage → body viewport`

В integrated режиме между workspace и stage добавляется stage-surface с toolbar внутри. В stacked режиме toolbar — сосед workspace внутри layout. Inspector — сосед поверхности таблицы в workspace.

| Слой | Текущее поведение | Оценка |
| --- | --- | --- |
| Runtime root | `flex: 1 1 auto; height: 100%`, `min-height: 0` | Единственная процентная высота; заполняет bounded host |
| Layout | Column flex, toolbar + workspace, `flex: 1 1 0%` | Растущий child; высота через flex |
| Workspace | Row flex, `flex: 1 1 0%` | Забирает высоту после toolbar и gap |
| Integrated surface | Column flex, `flex: 1 1 0%`, border-box | Stage занимает остаток после toolbar; border входит в размер |
| Stage | Flex, `flex: 1 1 0%` | Занимает workspace полностью |
| Grid stage | Grid, `auto minmax(0, 1fr)`, в fill `flex: 1 1 0%` | Header остаётся фиксированным, body получает остаток |
| Auto-height body | Inline `height` и `maxHeight` по row metrics | Нужный расчёт для виртуализированного содержимого, не следует заменять на высоту отрисованных DOM rows |

Источники: `src/theme/ensureDataGridAppStyles.ts`, `src/host/DataGridRuntimeHost.ts`, `src/host/DataGridDefaultRenderer.ts`, `src/stage/useDataGridTableStageRuntime.ts` в `packages/datagrid-vue-app`.

## Что усложняет использование

### H1. Fill не создаёт доступную высоту

`layoutMode` по умолчанию равен `fill`. Но `height: 100%` не даёт определённую высоту, если она не определена содержащим блоком. В обычном документном потоке без ограниченного host нельзя однозначно определить «оставшееся место».

Это ограничение CSS, а не задача для нового height manager. DataGrid может корректно использовать выделенное пространство, но не должен угадывать границы экрана, вычитать произвольные заголовки страницы или обходить DOM родителей.

### H2. Вложенные 100% скрывали распределение остатка — исправлено

Внутренние fill wrappers теперь используют `flex: 1 1 0%`; `min-height: 0` сохранён на слоях, которые должны сжиматься до host. Внешний root сохраняет `height: 100%`, а flex children расходуют остаток после toolbar и gap. Integrated surface использует `box-sizing: border-box`, поэтому рамка входит в высоту.

### H3. Документация контракта fill — исправлено

Getting started теперь использует `auto-height` для обычного потока, показывает фиксированный host и bounded CSS grid host с `minmax(0, 1fr)` и `min-height: 0` для заполнения оставшейся области. App guide разделяет размер host, component height, row height и предел `maxRows`.

### H4. Высота строк и высота таблицы — разные параметры

`rowHeightMode="auto"` меняет высоту отдельных строк. `layout-mode="auto-height"` меняет высоту компонента. Это разные задачи, но сходство названий требует явного объяснения.

`minRows`/`maxRows` действуют только в auto-height и относятся к body; они не задают полную высоту вместе с toolbar/header. В fill эти параметры нормализуются в null. Ноль и отрицательные значения считаются отсутствием ограничения.

### H5. Проверка bounded host и композиций — закрыто для проверенных сценариев

Playwright на настоящем DataGrid проверяет stacked, integrated и hidden toolbar compositions, body scrollport, увеличение host на 140 px и восстановление после display:none. Дополнительный browser fixture проверяет рост и shrink auto-height с min/max rows, empty state, inspector рядом со stage, pinned-bottom shell и Gantt resize через Gantt entrypoint. Исправление Gantt fixture использует поддерживаемый Gantt adapter, а не обычный DataGrid renderer.

## Предпочтительная интеграция

Эти рецепты теперь приведены в публичном onboarding. В Chromium проверены CSS Grid host для основного fill fixture, flex host для inspector composition, обычный bounded host для Gantt и обычный document-flow host для auto-height.

### Выделенная область

```vue
<div style="height: 480px">
  <DataGrid :rows="rows" :columns="columns" />
</div>
```

Host задаёт высоту всего DataGrid, включая встроенный toolbar.

### Остаток панели после заголовка

```vue
<section class="panel">
  <header>Заказы</header>
  <div class="panel__grid">
    <DataGrid :rows="rows" :columns="columns" />
  </div>
</section>
```

```css
.panel {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}
.panel__grid {
  min-height: 0;
  min-width: 0;
}
```

`100dvh` здесь — осознанное решение полноэкранной страницы. Внутри другого app shell панель получает размер от его layout. Внешний toolbar размещается как строка страницы и учитывается страницей; встроенный toolbar учитывает DataGrid.

### Высота по строкам

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  layout-mode="auto-height"
  :min-rows="4"
  :max-rows="12"
/>
```

Это режим для формы или документа без ограниченного host. При большом количестве данных нужен предел, иначе компонент растёт вместе с содержимым.

## Изменения первого slice

- Зафиксирован user-facing контракт: `fill` занимает высоту, которую выделил host; `auto-height` подбирает высоту по строкам. Публичный API не менялся.
- Внутренние layout, workspace, stage surface, stage и grid stage используют flex basis `0%` для распределения остатка; повторные `height: 100%` убраны. На root сохранён `height: 100%` как связь с внешним host.
- Integrated surface получил `box-sizing: border-box`, чтобы рамка входила в его выделенную высоту.
- Getting started теперь показывает auto-height для обычного потока и bounded grid host для fill. Различие component height, row height и maxRows пояснено в публичных руководствах.
- Добавлен CSS contract test для root host boundary и внутренних fill layers.

Браузерная матрица закрыта для текущих сценариев: stacked/integrated/hidden toolbar resize, body scrollport, toolbar вне root в hidden режиме, восстановление после display:none, auto-height min/max rows и empty state, inspector layout, pinned-bottom shell и Gantt resize. При регрессии корректировать конкретный flex слой, не возвращая проценты повсеместно.

Не рекомендую добавлять `fillParent`, `autoFit`, `fitHost`, ещё один layout manager или автоматическое переключение fill/auto-height по измерениям родителей. Они увеличат число способов решить одну задачу и могут создавать циклы resize. Отдельный `height` prop пока также не нужен: сначала проверить понятность стандартного `style` и контейнерного CSS после упрощения внутренних правил.

## Критерии завершения будущей реализации

- Fixed block host, flex column с header и CSS grid с `minmax(0, 1fr)` работают без селекторов внутренних элементов DataGrid.
- Stacked/integrated/hidden toolbar не увеличивает суммарную высоту за пределы host — проверено Chromium.
- Resize host и повторное открытие скрытого host обновляют viewport без пустых зон — проверено Chromium для обычного DataGrid.
- Inspector, pinned-bottom rows, empty state и Gantt сохраняют корректные размеры — проверено Chromium для fixture сценариев.
- В fill внутри body прокручиваются строки; внешний host не получает случайный вертикальный scrollbar.
- Auto-height увеличивается и уменьшается с набором строк, учитывает minRows/maxRows и отображает empty state — проверено Chromium. Переменная высота строк остаётся зафиксированной контрактными тестами; отдельный визуальный сценарий для неё не добавлялся.
- Нет циклов ResizeObserver или новых layout reads/writes в scroll path.

Runtime sizing CSS, onboarding и README обновлены. Type-check sandbox, 213 целевых unit tests и три Playwright sizing сценария проходят. Проверки были Chromium browser assertions, без ручного осмотра скриншотов.
