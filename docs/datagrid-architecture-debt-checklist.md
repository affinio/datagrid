# DataGrid Architecture Debt Checklist (v2)

Baseline date: `2026-02-07`
Scope: `packages/datagrid-core` + `packages/datagrid-vue`
Goal: close remaining architectural debt after 9.5 execution pipeline.

## Rules

- Закрываем по одному пункту за шаг.
- После закрытия пункта: ставим `[x]`, фиксируем оценку и комментарий, останавливаемся.
- Целевая оценка каждого пункта: `>= 9.0`.

## Backlog

## 01. Import Boundary Detox (`target >= 9.0`)

- [x] Убрать `@/...` alias-утечки из `datagrid-vue/src` (кроме README примеров).
- [x] Убрать legacy `@/ui-table/*` импорты в runtime исходниках.
- [x] Перевести cross-package core зависимости на `@affino/datagrid-core/*`.
- [x] Добавить локальные отсутствующие зависимости пакета (`useSelectableRows`, `useAutoResizeColumn`, `useFindReplaceStore`, UI primitives), чтобы исходники не зависели от demo alias.
- [x] Финальная оценка пункта: `9.1`.
- Комментарий по закрытию: `2026-02-07` - из `packages/datagrid-vue/src` устранены runtime alias-импорты `@/...` и `@/ui-table/*`; cross-package зависимости переведены на `@affino/datagrid-core/*` (включая imperative/selection/runtime modules). Добавлены недостающие локальные модули `src/composables/useSelectableRows.ts`, `src/composables/useAutoResizeColumn.ts`, `src/stores/useFindReplaceStore.ts`, а также UI-блоки `src/components/ui/*` (`VirtualList`, `VirtualList.types`, `LoadingSpinner`, `UiSelect`, `DraggableList`). Добавлены path alias для theme imports в `tsconfig.base.json`. Метрика: `@/...` imports в `src` (без README) `29 -> 0`; `../../core|../../../core` imports `169 -> 0`.

## 02. DataGrid Component Decomposition (`target >= 9.0`)

- [x] Разбить `DataGrid.vue` на feature blocks (header orchestration, row-selection, find/replace bridge, viewport bridge).
- [x] Убрать неявные cross-feature side-effects из watcher-комбинаторики.
- [x] Ввести тонкие facade hooks вместо прямой сборки всего runtime в одном SFC.
- [x] Финальная оценка пункта: `9.1`.
- Комментарий по закрытию: `2026-02-07` - введены feature-facades: `src/features/useDataGridHeaderOrchestration.ts`, `src/features/useDataGridRowSelectionFacade.ts`, `src/features/useDataGridFindReplaceFacade.ts`, `src/features/useDataGridViewportBridge.ts`, и `DataGrid.vue` переключен на них. Из SFC вынесены неявные cross-feature side-effects: selection reset watcher, checkbox-indeterminate watcher и viewport scroll RAF queue/cancel state (теперь локализованы в фасадах). Добавлены facade tests: `src/features/__tests__/useDataGridRowSelectionFacade.spec.ts`, `src/features/__tests__/useDataGridViewportBridge.spec.ts`, `src/features/__tests__/useDataGridHeaderOrchestration.spec.ts`. Документация: `docs/datagrid-component-decomposition.md`.

## 03. Selection Engine Facade (`target >= 9.0`)

- [x] Убрать legacy фокус на `useTableSelection`: перевести selection-контракт на актуальные фасады (`useDataGridRowSelectionOrchestration` / `useDataGridRowSelectionFacade`).
- [ ] Убрать прямое знание о DOM/render-подробностях из high-level API.
- [ ] Добавить contract docs для selection facade (input/output guarantees).
- [ ] Финальная оценка пункта: `>= 9.0`.
- Комментарий по закрытию: `in progress` — legacy `useTableSelection` как целевой public surface неактуален (selection split уже на новых фасадах), но в high-level API всё ещё присутствуют DOM/event-детали; требуется отдельный doc-контракт для selection facade.

## 04. Theme Ownership Cleanup (`target >= 9.0`)

- [x] Закрыть `TODO(theme)` и завершить вынос theme preset ownership из core-runtime слоя.
- [x] Уточнить границу: tokens/theme utilities vs runtime logic.
- [x] Зафиксировать docs по theme ownership.
- [x] Финальная оценка пункта: `9.2`.
- Комментарий по закрытию: `2026-02-09` - theme presets/utilities вынесены в `@affino/datagrid-theme`, plugin contracts перенесены в `@affino/datagrid-plugins`, core exports очищены, demo переведен на новый theme пакет, добавлены docs по ownership.

## 05. Public Surface Hardening (`target >= 9.0`)

- [x] Зафиксировать staged public API через tiered entrypoints (`stable`/`advanced`/`components`) вместо legacy-формулировки `@affino/datagrid-vue/public`.
- [x] Формально зафиксировать compatibility contract для deep imports (versioned public protocol + codemod contracts).
- [x] Зафиксировать guard в consumer path: semver-safe exports map + forbid deep imports в protocol rules.
- [x] Финальная оценка пункта: `9.0`.
- Комментарий по закрытию: `2026-02-21` - публичная поверхность `@affino/datagrid-vue` нормализована через tiered exports (`./stable`, `./advanced`, `./components`); deep imports формально запрещены в versioned public protocol (`@affino/datagrid-core/src/protocol/versionedPublicProtocol.ts`) и покрыты codemod contract tests (`publicProtocolCodemod.contract.spec.ts`), а migration путь закреплён root-командой `codemod:datagrid:public-protocol`.

## Close Log

- `2026-02-07`: создан v2 debt checklist.
- `2026-02-07`: закрыт пункт `01` (import boundary detox + local missing module recovery).
- `2026-02-07`: закрыт пункт `02` (DataGrid component decomposition + facade hooks).
- `2026-02-09`: закрыт пункт `04` (theme preset ownership moved to datagrid-theme + plugin contracts moved to datagrid-plugins).
- `2026-02-21`: зафиксирован roadmap перехода к declarative engine-архитектуре и preventive guardrails в `docs/archive/datagrid/checklists/datagrid-engine-transition-and-guardrails-checklist.md`.
- `2026-02-21`: re-baseline debt checklist — пункт `05` закрыт, пункт `03` уточнён как частично закрытый (legacy scope removed, high-level DOM abstraction/docs still pending).
