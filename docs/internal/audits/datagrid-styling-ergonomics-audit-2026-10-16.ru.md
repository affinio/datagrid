# Аудит удобства оформления DataGrid

Дата: 2026-10-16. Статус: все UX пункты аудита закрыты реализацией; полный браузерный визуальный проход оставлен в чек-листе перед релизом.

## Итог

Путаницу создаёт распределение визуальной ответственности между runtime host, layout, stage, toolbar и внешней карточкой. Самый очевидный светлый фон за углами таблицы рисовал `.affino-datagrid-app-root`: у него прямоугольный фон, а у дочернего `.grid-stage` радиус 8px и `overflow: hidden`.

Исправлено: host прозрачен; таблица сохраняет собственную поверхность. Также исправлен приоритет явных theme `tokens`, а вынесенный `DataGridModuleHost` получил те же `theme` и `chrome` props, что и DataGrid. Showcase больше не рисует второй белый panel вокруг DataGrid. Оставшаяся внешняя поверхность sandbox намеренна: `VueGridCard` включает заголовок, controls, метрики и footer, а не только таблицу.

## Кто рисует поверхность

| Элемент | Роль |
| --- | --- |
| Внешняя карточка приложения | Фон страницы, отступы, дополнительный border/radius |
| `.affino-datagrid-app-root` | Theme scope и flex host; теперь фон прозрачный |
| `.datagrid-app-layout` | Вертикальная компоновка и gap toolbar |
| `.datagrid-app-workspace` | Stage и inspector, горизонтальный gap |
| `.datagrid-app-stage-surface--integrated` | Общая рамка/радиус/clip для integrated toolbar и таблицы |
| `.datagrid-app-toolbar` | Компоновка модулей, цветные токены и density |
| `.grid-stage` | Фон таблицы, radius 8px, clip и рамка через `::before` |
| Header/body panes | Собственные фоны и функциональные scroll/clipping слои |
| Canvas chrome | Линии и полосы строк, зависящие от theme токенов |

В stacked режиме toolbar находится отдельно над stage. В integrated он обёрнут вместе со stage в отдельную поверхность. Integrated фактически включается только когда есть toolbar modules; для Gantt он заменяется на stacked. В hidden режиме потребитель рендерит опубликованные модули сам.

## Подтверждённые источники светлых зон

### Host за скруглённой таблицей — устранено

Ранее `.affino-datagrid-app-root` имел непрозрачный `--datagrid-background-color`, но без радиуса. `.grid-stage` обрезал собственное содержимое, но не фон родителя. У светлой темы фон белый, поэтому в углах и gaps root был виден. Host теперь прозрачен, фон остаётся у stage и integrated surface.

Sandbox дополнительно оформляет `.card` как белую карточку с собственной рамкой и padding. Это намеренная внешняя поверхность; её фон остаётся виден за stage. Для конкретного sandbox экрана нужно отличать этот слой от общего root.

### Внешняя поверхность — источник установлен и упрощён

В showcase `.showcase-grid-panel` дублировал фон, рамку, radius и clipping DataGrid. Эти свойства удалены; wrapper оставлен для геометрии и overlay selection summary. В sandbox `.card` намеренно обрамляет также заголовок, controls и footer, поэтому это отдельная поверхность приложения, а не фон таблицы.

## Theme и CSS

### Явные `tokens` перекрывались variant — исправлено

Theme config объединяется с `defaultStyleConfig`, где light/dark варианты полные. Resolver применяет variant поверх `config.tokens`, поэтому частичные значения `theme.tokens` ранее затирались унаследованным variant. Теперь app merge распространяет явные config `tokens` на унаследованные варианты; variant, который явно задал сам потребитель, по-прежнему перекрывает base token. Flat token object продолжает накладываться на resolved тему последним.

### Токены доступны, но не дают универсального CSS override

DataGrid применяет theme variables inline к root; CSS переменные с родителя поэтому не перекрывают локальные значения. Layout также устанавливает inline chrome variables. Значимые цветовые роли разделены между stage, viewport, rows, header и pinned panes; это полезные роли, но потребителю нужен короткий вход. Радиус поверхности задаётся theme token `surfaceRadius`, по умолчанию 8px.

### Toolbar терял theme scope и density — исправлено

`DataGridModuleHost`, вынесенный за пределы DataGrid root, не наследовал inline variables или compact density соседней таблицы. Теперь его можно использовать как `<DataGridModuleHost :modules="modules" :theme="theme" :chrome="chrome" />`; встроенный renderer передаёт ему те же значения автоматически. Пример добавлен в README.

## Упрощённая модель

1. Host отвечает за layout и theme scope; внешний фон прозрачен.
2. Stage отвечает за фон, рамку, радиус и clipping самой таблицы.
3. Integrated toolbar и таблица входят в одну поверхность.
4. Stacked toolbar находится вне поверхности таблицы; hidden host получает те же theme/chrome значения явно.
5. Приложение отвечает за фон страницы и внешний card, если он действительно нужен.

Не переносить `overflow: hidden` на весь root: он может содержать toolbar и inspector. Не создавать новый theme manager или renderer ради этого слоя.

## Закрытие пунктов и оставшееся решение

| Пункт | Статус |
| --- | --- |
| Фон host и углы stage | Исправлено: root прозрачен, stage рисует свою поверхность |
| Дублирующая карточка showcase | Исправлено: внешний panel больше не задаёт фон, рамку или clipping |
| Внешняя sandbox card | Намеренная: обрамляет весь демонстрационный сценарий с controls |
| Theme precedence и внешний toolbar | Исправлено и покрыто contract tests |
| Режимы toolbar и layout | Документирована модель ownership; integrated surface создаётся только для integrated размещения с toolbar modules |
| Глобальные selectors runtime CSS | Зафиксировано как отдельное техническое ограничение: селекторы принадлежат app stage и overlays; безопасная изоляция требует отдельной миграции с проверкой teleport, standalone stage и core sandbox |
| Radius поверхности | Закрыто: добавлен `theme.tokens.surfaceRadius`, default `8px`; применяется к stage, integrated surface и split Gantt table |

`ensureDataGridAppStyles.ts` содержит большой runtime stylesheet с class selectors для stage, используемых app layout. Его namespace cleanup отделён от устранения фоновых зон: `datagrid-demo.css` не импортируется runtime и не был причиной найденных углов.

Canvas chrome рисует часть оформления вне DOM backgrounds. В актуальном коде уже есть theme revision и e2e coverage для repaint; не смешивать возможные canvas расхождения с фоном host без отдельного воспроизведения.

Проверены theme config tokens в light/dark, явный variant priority, внешний toolbar с theme/density, прозрачность app root и границы clipping stage. Package type-check и целевые contract tests проходят. Перед релизом выполните визуальную проверку focus ring, editor, popup/menus, pinned panes, header/body alignment и virtualization gaps на stacked/integrated/hidden композициях.
