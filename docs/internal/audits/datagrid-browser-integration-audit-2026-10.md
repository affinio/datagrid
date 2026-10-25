# Affino DataGrid: browser integration audit

Дата: 2026-10-25. Статус исходного этапа: **read-only аудит завершён**. Область: Vue renderer, viewport, interaction layer; DOM/Laravel не проверялись. Исходный запуск подтвердил два функциональных дефекта P2 и одно временное визуальное рассогласование P3. Исправления и регрессии зафиксированы ниже; исходные наблюдения сохранены как исторические результаты аудита.

## Статус исправлений

| Finding | Статус | Исправление и проверка |
| --- | --- | --- |
| BR01 row resize после выбора строки | Исправлено | Удалён selected-index CSS override, который переводил resize control из absolute layout. Chromium regression кликает ячейку, проверяет hit target и изменение высоты, а затем подтверждает сохранение anchor. |
| BR02 coarse touch fill handle | Исправлено | 28px touch target перемещён внутрь owner cell; декоративная метка остаётся у угла. Trusted CDP touch начинает fill с центра handle и отменяет preview через `touchCancel`. |
| BR03 reorder header/body | Исправлено | Удалена независимая FLIP-анимация только заголовка; фокус и reorder остаются. Chromium regression сравнивает положение заголовка и body cell после keyboard reorder с допуском 1 CSS px. |
| BR04 diagonal wheel (решение пользователя) | Исправлено | Mixed wheel проходит через оба существующих managed scroll owner без axis lock. Chromium и unit regressions проверяют оба знака/соотношения дельт; двигаются обе оси. |

Выполнено после изменений: `pnpm --filter @affino/datagrid-vue type-check`; два целевых Vitest файла (**56 тестов**); `pnpm exec playwright test e2e/browser-integration-regressions.spec.ts --workers=1` (**4 passed**) на Chromium. Полный Vue unit suite: **1138 passed, 2 failed** — оба оставшихся ожидания относятся к стилям selection/header (`DataGrid.contract.spec.ts` и `DataGridTableStage.contract.spec.ts`), вне затронутых browser fixes; рабочее дерево уже содержало связанные незакоммиченные selection изменения. Sandbox production build внутри Playwright webServer прошёл; остаются обычные предупреждения Vite о динамическом импорте и размере bundle. Изменения входят в незакоммиченное дерево; не являются проверкой опубликованного tarball.

## Исходная точка и среда

- HEAD `79092ff0e7ba27181237c3e4db57b1186f157be0`. На старте 74 записи `git status --short`: незакоммиченные fixes identity/overload и изменения Vue/chrome/sandbox уже присутствовали. Это аудит текущего рабочего дерева, а не опубликованного релиза или чистого commit.
- Прочитаны viewport/math, strict-contract, accessibility и mobile/touch contracts. Старый путь `docs/MOBILE_TOUCH_SCROLL_AUDIT.md` отсутствует; использован фактический `docs/internal/audits/202605/MOBILE_TOUCH_SCROLL_AUDIT.md`.
- Linux aarch64; Node 24.21.0; pnpm 10.30.3; Playwright 1.58.2; **Chromium 145.0.7632.0, headless**.
- Sandbox и отдельная диагностическая Vue fixture собраны production Vite build из workspace source aliases. Оба build прошли с предупреждением о размере chunks. Это не tarball/packaging validation.
- SHA256 tracked product diff до/после: `b538037b757f07aa7c3943e47c38d6d8734ce9068f9f2613fea6d7455f3341ee`. Хеши совпали. Добавлены только audit scripts/fixture/docs/artifacts.
- [Команды и harness](../../../scripts/audits/datagrid-browser-integration/README.md), [измерения, события и результаты тестов](./202610/browser-integration/results.json). Исходные полные samples и дополнительные screenshots — `/tmp/affino-browser-integration`.

## Ограниченная матрица

| Измерение | Реально проверено | Граница вывода |
| --- | --- | --- |
| Left / center / right | `/vue/grouped-header-grid?rows=1000&cols=32`, shell и fixture 1000 × 33; pinned bottom — timesheet | X-scroll двигает центр; исходные left/right activation в fixture сохраняют center `scrollLeft=605` |
| Sticky | Shell grouped-grid, `root-only`, `push-off`; scroll 0–900 и точная граница 8283 | В публичной конфигурации реализован только root-only; sticky stack нескольких уровней не заявляется |
| X/Y virtualization | 1000 × 32, 50k × 128 и 50k × 8; remount anchors и keyboard reveal | Не full Cartesian product режимов |
| Высота | Fixed 31; auto на 50k строк; manual resize невыбранных строк; override строки 0 выше viewport | Auto + поздний font + sticky одновременно не проверены |
| Дробная геометрия | DPR 1.25 и CSS zoom 125%; в fixture width 98 → 122.5, 123 → 153.75 CSS px | Authored widths 98.75/123.5 нормализуются Core через `Math.trunc`, это существующая семантика, не дефект |
| Viewports | 1440×1000 → 1120×850; fixture 1280×900; timesheet 1280×900; sizing 1600×1200; defaults 1280×720 | Дополнительно high-DPI тест 1025×769 → 897×673, DPR 1.25 |
| Zoom / DPR | Browser zoom 100%; DPR 1, 1.25, 2; CSS zoom 100/125% | CSS zoom отдельно от native browser zoom. Ctrl+/OS scaling не сертифицированы |
| Pointer | Настоящие Playwright mouse/keyboard; CDP touchStart/move/cancel с `isTrusted=true` | Chromium touch emulation не означает проверку iOS/Android hardware |
| RTL | Не включён | Заявленный app-stage RTL contract в проверенных публичных docs/API не найден; подмена `dir` не считается поддержкой |

Допуски: **1 CSS px** для DOM/overlay/divider alignment с учётом stroke и clipping; для растровых границ — до одного device pixel без выводов по одному antialiasing-пикселю. Существующий timesheet тест отдельно подтвердил две выбранные canvas-границы с допуском `<0.2 CSS px` при DPR 1. Эти два образца не доказывают pixel-perfect rasterization всех canvas при любом DPR.

## Карта геометрии и действий

| Ответственность | Владелец / путь |
| --- | --- |
| Проекция rowId / columnKey | Core row/column models; публичные `api.rows` и `api.view.activateCell` |
| Scroll owners и peers | `useDataGridStageViewportRuntime.ts`: shared vertical owner, center horizontal owner, sync header/pinned-bottom; Core viewport scroll IO/render-sync |
| DOM rows и pane offsets | `DataGridTableStageCenterPane.vue`, `DataGridTableStagePinnedPane.vue`, stage row metrics / pane layout |
| Overlay bounds и clipping | `useDataGridStageOverlays.ts` → `dataGridStageOverlayGeometry.ts`; pane segments используют stage row/column metrics |
| Gridlines | `useDataGridStageChromeModel.ts` → `useDataGridStageChromeCanvas.ts` / `dataGridChromeCanvasMath.ts`; часть scroll-owned center lines — DOM chrome, часть pinned/header/bottom chrome — canvas |
| Sticky placement | `dataGridStickyGroupLayout.ts:resolveStickyRootGroupPlacement` → source index, viewportY, visibleRect → pane clones |
| Pointer target и owner | DOM event target → stage render APIs → `useDataGridAppInteractionController`; row index hit lookup также использует `document.elementFromPoint` |
| Focus | [Roving DOM focus contract](../../datagrid-accessibility.md): cell/index или viewport fallback. App stage не должен выдавать `aria-activedescendant`; в samples таких ссылок нет |

Координатные assertions используют DOM bounding boxes и `elementFromPoint`, а не вторую копию production geometry helper. Для fixture логическая цель фиксирована literals `audit-50/c12`, `audit-51/c12`, group G0. Expected identity не вычисляется из выбранной production ячейки.

## BR01 — P2: selection убирала hit area row resize handle (исправлено)

**Уверенность: высокая, native desktop reproduction.** Нарушен инвариант: декоративное выделение индекса не должно менять layout/hit area независимого resize affordance.

Минимальный сценарий на `/vue/base-grid?rows=1000&cols=32`:

1. До selection у row 0 resize handle bbox `56 × 6`.
2. Кликнуть Amount строки `base-1`.
3. У этого же handle bbox становится **`0 × 6`**, computed `position: relative`, `width: 0px`.
4. Потянуть мышью предполагаемый handle вниз на 34 px. Высота строки остаётся **31 → 31**. Настоящие `pointerdown/mousedown` получают row-index cell, затем начинается её pointer capture/выбор, вместо row resize.

Логическая цель: изменить высоту `base-1`. Фактическая цель: row-index selection; после жеста anchor оказывается на data column `id`, а не сохраняет Amount. У незатронутых selection строк manual resize работает — это объясняет прохождение существующего height-sizing теста, который выбирает row 6, а ресайзит rows 4/2.

Причина: [ensureDataGridAppStyles.ts:2093](../../../packages/datagrid-vue/src/app-layer/theme/ensureDataGridAppStyles.ts#L2093) переопределяет `.grid-cell--index-selected .row-resize-handle` в `position: relative`. Базовое правило [там же:4062](../../../packages/datagrid-vue/src/app-layer/theme/ensureDataGridAppStyles.ts#L4062) полагается на absolute left/right stretching; при relative positioning пустой button в flex cell схлопывается. `DataGridTableStagePinnedPane.vue` связывает button mousedown с `rows.startRowResize`, а родительский index pointerdown — с row selection, поэтому ошибочный hit получает другого владельца.

Доказательства: observation `selected-row-resize-hit-area` в JSON, trusted event targets и [screenshot](./202610/browser-integration/selected-row-resize.png). Существующий browser test `column and row resize near adjacent controls finish without selection drift` падает с `31 > 45`.

Минимальное исправление: сохранить absolute geometry handle при изменении слоёв selected index; z-index/декоративный marker не должны переводить control в normal flow. Регрессия: native mouse выбирает cell → проверяет ненулевую ширину handle → drag → row height меняется, anchor сохраняется, затем новый selection/edit работают. Дополнительно проверить pointerdown ownership на самом resize control после восстановления его площади; отдельный capture defect этим аудитом не доказан.

## BR02 — P2: coarse fill handle направлял центр касания в соседнюю запись (исправлено)

**Уверенность: высокая для Chromium touch emulation.** Нарушен инвариант: видимая/объявленная touch hit area handle должна принадлежать тому же действию и logical cell.

На `/vue/base-grid` с `hasTouch:true`, DPR 1 выбрать `base-1/amount`:

- Cell bbox: `x=452, y=505.171875, width=140, height=31`, right/bottom `592/536.171875`.
- Handle bbox: `x=578, y=522.171875, width=28, height=28`.
- Center `(592, 536.171875)` даёт `elementFromPoint` **`base-2/start`**, не fill button.
- Из 25 точек сетки вокруг центра только **4** попали в `.cell-fill-handle`. Center native `touchStart` действительно пришёл в соседнюю date cell; fill не начался.
- Контроль: сдвиг на `(-4,-4)` внутрь owner cell запускает настоящий touch fill, move создаёт preview, `touchCancel` убирает dragging/preview. Отмена исправно работает для жеста, который действительно начался.

Цепочка: [coarse CSS:4091](../../../packages/datagrid-vue/src/app-layer/theme/ensureDataGridAppStyles.ts#L4091) / media-query расширяют button до 28 px и выносят его на `right/bottom:-14px`; [`.grid-cell`:1498](../../../packages/datagrid-vue/src/app-layer/theme/ensureDataGridAppStyles.ts#L1498) остаётся `overflow:hidden`. Интерактивный элемент находится внутри clipped cell в [CenterPane.vue:103](../../../packages/datagrid-vue/src/app-layer/stage/DataGridTableStageCenterPane.vue#L103), аналогичный markup есть в pinned pane. У наружной части bbox нет доступной hit area. Поэтому `useDataGridStagePointerInteractions.ts:handleFillHandleTouchStart` вообще не получает center gesture.

Доказательства: `coarse-fill-handle-hit-area`, `native-pointercancel-events`, `touch-inside-handle-*` в JSON и [screenshot](./202610/browser-integration/coarse-fill-handle.png). Это не вывод по antialiasing или synthetic TouchEvent.

Минимальное направление: согласовать paint и hit area explicit handles с общим pane/overlay clipping contract. Например, полностью разместить touch target в доступной области owner cell либо использовать существующий pane overlay для интерактивной площади. Не делать все cells overflow-visible: это затронет renderer clipping и pinned occlusion. Регрессия должна начать CDP/native touch в центре **видимого marker/target**, проверить trusted target owner, preview и cancel; одного `dispatchEvent('touchstart')` на найденном button недостаточно.

## BR03 — P3: header-only reorder animation временно расходилась с body (исправлено)

**Уверенность: высокая; transient visual discrepancy, неправильная запись данных не доказана.** Header animation намеренная, но её координаты не совпадают с уже перестроенной колонкой тела/сеткой.

Fixture: activate `audit-50/c12`, center прокручен, focus header C12 → `Shift+Alt+ArrowRight`. Frame trace из 14 rAF samples:

- На первом кадре header C12 отстаёт от body C12 на **98 CSS px**; непосредственно под центром надписи C12 находится body **C13**.
- Через ~38 ms расхождение ~62.6 px, под header center всё ещё C13.
- Через ~106 ms расхождение ~11.6 px; после завершения animation — **0**.

Источник: [DataGridTableStageHeader.vue:1441](../../../packages/datagrid-vue/src/app-layer/stage/DataGridTableStageHeader.vue#L1441), `animateHeaderReorder`: Web Animations `translate3d` только на leaf headers, duration **140 ms**. Body, gridlines и selection уже используют новый column order. Это не stale final layout: после animation geometry совпадает. Сам по себе intended animation не доказывает неверную mutation, поэтому finding имеет P3 и узкий визуальный scope.

Доказательства: `reorderTrace` в JSON, а также transient mismatches в `keyboard-column-reorder-while-scrolled` fixture checkpoint. Минимальный вариант — убрать независимое движение header, пока нет общего column animation contract. Альтернатива — единая анимация целой колонки с согласованными hit/overlay/pane transforms; не отдельные offsets для header, canvas и DOM. Регрессия: rAF sampling во время reorder, а не только после 140 ms; отдельно `prefers-reduced-motion`.

## Проверенные сценарии без подтверждённых расхождений

- В основных 4253 cell-center samples шапка/тело имели maximum horizontal edge delta **0 CSS px**. 60 несовпадений `elementFromPoint` — намеренное перекрытие source cells sticky clone; неподтверждённых wrong targets среди остальных samples нет. Эти counts относятся к зафиксированному запуску, не к лимиту покрытия.
- Sticky root push-off: при scrollTop 8253/8268/8282 верх clone последовательно 680/665/651; на 8283 clone заменяется естественной source group. Клик по North sticky clone при scrollTop 900 выбирает именно North/hierarchy и сохраняет scrollTop 900.
- Pinned header/body X alignment, center/header scroll peers; обе проверенные timesheet canvas границы и seam между body/pinned bottom; overlay/divider во время resize **невыбранных** rows — до 1 CSS px.
- X/Y virtualization, horizontal keyboard reveal, remount selected anchor/fill handle, right-pinned checkbox overlay, keyboard за rendered window; auto-height viewport coverage в выбранных long jumps.
- Native column resize при scrollLeft 605: width **98 → 118**; settled header/body geometry совпала. Keyboard reorder переставляет C12/C13; transient divergence отдельно BR03.
- Public activateCell после sort: `audit-50` перемещается с index 50 на 949, identity/visible hit/focus остаются `audit-50/c12`.
- Collapse родителя active leaf переводит фокус/selection на видимый G0. Activation без expansion возвращает `unavailable:ancestor-collapsed`; с `expandAncestors:true` возвращает `activated` и показывает нужный leaf.
- Row-height override выше viewport: row 0 **31 → 96**, после explicit `view.refresh()` target смещается на ожидаемые 65 px, overlay/hit остаются согласованы. ArrowDown выбирает `audit-51/c12`, а не старый индекс.
- Container resize и hide/show после X scroll; поздний `FontFace` load в fixed-height grid; дробные rendered widths при CSS zoom. Из этого не следует поддержка всех auto-height/font combinations.
- Native Escape во время fill/autoscroll: preview/dragging исчезают, scroll выходит на стабильное значение; новое редактирование работает. Mouse release вне viewport/range move Escape покрыты дополнительно существующими browser tests, где release за пределами окна инжектируется синтетически.
- Настоящие got/lostpointercapture получены через row-index mouse gesture + `releasePointerCapture`; после mouseup capture/preview не остаются. Отдельной отмены непосредственно на lostpointercapture публичный контракт не обещает: controller использует global window fallback. Это не объявлено дефектом автоматически.
- Настоящий touch pointercancel из активного fill очищает preview/owner. Router unmount во время mouse fill: старый stage detached, новый stage без preview; это Vue unmount через программный клик существующей router link, не полная перезагрузка документа.
- CDP IME: trusted compositionstart; Enter и Escape имеют `isComposing:true`, editor остаётся открыт. После composition Escape закрывает его; новый ввод/Enter работают. Native Ctrl+C/V внутри editor восстанавливает `123`, не подменяется grid paste.
- Roving focus targets в activation/collapse/remount checkpoints подключены к DOM. Отсутствие app-stage `aria-activedescendant` соответствует принятой стратегии, а не accessibility defect.

## Валидация и ограничения

- **26 выполнений / 25 уникальных существующих Playwright cases**: 25 passed, 1 failed (BR01); keyboard reorder test запускался дважды.
- Новый diagnostic harness: **69 records**, controlled fixture: **20 checkpoints**, reorder trace: **14 frames**. Ошибок загрузки/harness/pageerror нет. Наличие records без harness errors не превращает диагностические findings в passing correctness tests.
- Прогонялся настоящий Chromium, jsdom не использовался. Builds и browser checks реально выполнены; production type-check/full unit suite повторно не запускались, продуктовый код не менялся.
- Реальную потерю OS window focus подтвердить не удалось: headless `bringToFront` другой страницы не создал trusted blur с `event.target===window`. Сохраняющийся при таком tab-switch autoscroll не объявлен дефектом. Отдельная **synthetic window blur injection** остановила owner/preview/autoscroll; native desktop focus-loss остаётся ручной проверкой.
- OS IME candidate UI, physical touch/pen, iOS Safari, Firefox/WebKit, native browser zoom, RTL, reduced-motion reorder, одновременные gestures, arbitrary custom renderer overflow и долгие session races не сертифицированы.
- Canvas alpha samples не всегда выделяют отдельный divider на непрозрачных row bands; нет вывода о пиксельной корректности всех raster lines. Для основного center grid часть линий вообще DOM chrome — название canvas mode не означает, что каждый divider является canvas-пикселем.
- Ранее известное unit-падение partial-range header highlight не переобъявлялось новым finding. Identity/memory/compute correctness и DOM adapter не переаудировались.

### Diagonal wheel policy — согласовано и реализовано

Native `wheel(0,200)` над центром fixture увеличивал shared vertical scrollTop, а mixed `wheel(120,240)` раньше увеличивал только center scrollLeft и терял Y в Chromium. После проверки пользователь уточнил ожидаемое поведение: **обе оси должны прокручиваться вместе**.

Теперь mixed жесты с X компонентом направляются через существующий managed wheel path с отключённым axis lock; каждый ненулевой delta применяется к соответствующему owner. Чистый вертикальный жест по-прежнему остаётся native. Unit tests и Chromium regression проверяют оба соотношения: `wheel(120,240)` и `wheel(240,120)` изменяют и X, и Y.

## Порядок исправлений

1. Основные finding BR01–BR04 закрыты локальными CSS/viewport corrections без новых координаторов и публичного API.
2. Отдельно остаются ручные проверки физического touch/pen, OS IME candidate UI и native window-focus; headless Chromium emulation их не сертифицирует.
