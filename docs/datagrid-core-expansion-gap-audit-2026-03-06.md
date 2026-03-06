# DataGrid Core Expansion Gap Audit (2026-03-06)

Goal: identify what is truly missing vs what is already in core/adapter/app, then build an implementation pipeline with complexity and core break risk.

## Legend

- Status:
  - `present` = implemented and usable in current layer.
  - `partial` = exists but incomplete, headless-only, or not wired end-to-end.
  - `missing` = not implemented in this layer.
- Complexity:
  - `S` small, `M` medium, `L` large, `XL` very large.
- Core break risk:
  - `low`, `medium`, `high`.

## Reality Check Matrix

| Capability | Core | Adapter (`datagrid-vue`/orchestration) | App `<DataGrid />` | Actual gap |
| --- | --- | --- | --- | --- |
| Multi-column sorting priority | present | present | present | none |
| Custom comparator per column | missing | missing | missing | core extension required |
| Locale-aware sortable policy (configurable) | partial | partial | missing | configurable comparator policy missing |
| Natural sorting | missing | missing | missing | core extension required |
| Filter DSL / advanced expressions | present | present | present (`filterDsl`) | none |
| Column filter UI | present (filter model only) | partial (legacy `useAffinoDataGrid` header filters + `filterBuilderUI`) | partial (JSON builder shell) | production-grade per-column UX still missing |
| Quick filter / global search model | missing (only generic filter model) | partial (`useDataGridQuickFilterActions` = clear action only) | missing | core + app design missing |
| Saved filters / presets | missing | missing | missing | state model + UI missing |
| Selection range/cell/row | present | present | present | none |
| Column selection mode | missing | missing | missing | core + app missing |
| Selection resize handles | partial (fill primitives exist) | partial | missing | app interaction module missing |
| Clipboard plain text copy/paste | present | present | present | none |
| Excel formula paste / HTML clipboard / rich metadata | missing | missing | missing | adapter + app clipboard extension required |
| Pivot engine/model/layout/drilldown | present | present | present | none |
| Advanced pivot engine (refresh control) | present | partial | partial | app wrapper is thin, no dedicated UI |
| Grouping + expansion + aggregates in group nodes | present | present | partial | app renders plain rows, no rich group UI |
| Group footers / per-level total rows | missing | missing | missing | core projection stage extension required |
| Tree data + expand/collapse | present | present | partial | no high-level tree props/UI in app |
| Column pinning / visibility / resize / reorder APIs | present | present | partial | app has built-in column menu for pin/visibility/autosize, but no resize/reorder UI yet |
| Column groups / nested headers / header spans | partial (types only) | missing | missing | core runtime + app header renderer missing |
| Row pinning (top/bottom frozen rows) | partial (`row.state.pinned` type only) | missing | missing | core API/projection behavior missing |
| Row height API | partial (depends on viewport service methods) | present (default viewport fallback methods are available) | present | custom viewport services may still omit optional row-height methods |
| Column virtualization toggle | partial (viewport has virtualization flag, no stable column toggle API) | present (adapter bridges stable + legacy viewport methods) | present | no major gap in app path |
| Server-side row model | present | present | partial (via `rowModel` prop) | convenience builder and UI contracts missing |
| Transactions / batch / undo-redo | present | present | present | none |
| Patch/delta pipeline + immutable mode | present | present | present | none |
| Unified state save/restore + migration | present | present | present | none |
| CSV export | partial (text export path) | present | present | good enough for CSV |
| Excel export (`.xlsx`) | missing (native workbook writer) | partial (TSV with xlsx mime) | partial | real workbook export missing |
| Aggregation function registry | partial (custom aggregators per model exist) | partial (registry materializes aggregation model handlers) | partial | still not a first-class core service/contract |
| Group panel / pivot panel / filter builder UI | missing | present (headless state + app shells) | present (basic toolbar/panel shells) | richer enterprise UX still missing |
| Devtools inspector / profiler / pipeline debugger | partial (`api.diagnostics`) | partial | missing | dedicated devtools package missing |

## Evidence (code pointers)

- Core API contracts: `packages/datagrid-core/src/core/gridApiContracts.ts`
- Sort behavior and multi-column descriptors: `packages/datagrid-core/src/models/clientRowProjectionPrimitives.ts`
- Tree/pivot/group/aggregation model contracts: `packages/datagrid-core/src/models/rowModel.ts`
- Group projection and aggregate patching: `packages/datagrid-core/src/models/groupProjectionController.ts`, `packages/datagrid-core/src/models/clientRowProjectionAggregateStage.ts`
- Unified state API: `packages/datagrid-core/src/core/gridApiStateMethods.ts`, `packages/datagrid-core/src/core/gridApiContracts.ts`
- Runtime transactions: `packages/datagrid-core/src/core/gridApiTransactionMethods.ts`
- App feature registry and current wrapper behavior: `packages/datagrid-vue/src/composables/useDataGridFeatureRegistry.ts`
- Current app shell renderer: `packages/datagrid-vue/src/components/DataGrid.vue`, `GridHeader.vue`, `GridBody.vue`, `GridRow.vue`, `GridCell.vue`, `GridFeaturePanels.vue`, `GridColumnMenu.vue`
- Runtime default viewport fallback wiring: `packages/datagrid-orchestration/src/createDataGridRuntime.ts`
- Quick filter helper scope: `packages/datagrid-orchestration/src/useDataGridQuickFilterActions.ts`

## Requested Capability Checklist (from product audit)

| Requested capability | In `DataGridFeatureName` | App `<DataGrid />` wiring | Current note |
| --- | --- | --- | --- |
| `sorting` | yes | yes | Header click + menu actions are wired. |
| `columnPinning` | yes | partial | Wired via column menu; no drag pin UX. |
| `columnVisibility` | yes | partial | Hide action wired; no full column chooser panel. |
| `columnAutosize` | yes | partial | Menu autosize action wired; no batch autosize UI. |
| `columnMenu` | yes | yes | Built-in menu is backed by `@affino/menu-vue` primitives. |
| `serverSideRowModel` | yes | partial | Works through `rowModel`/feature wiring, no high-level datasource props yet. |
| `rowHeight` | yes | yes | Runtime fallback now exposes row-height methods. |
| `columnVirtualization` | yes | yes | Feature bridged to stable+legacy viewport methods. |
| `export` (CSV) | yes (`export`) | yes | Export API ready; no default toolbar action yet. |
| `exportExcel` | yes | partial | TSV payload with xlsx mime; native workbook writer missing. |
| `aggregationFunctionsRegistry` | yes | partial | Registry integrated into aggregation model materialization. |
| `groupPanel` | yes | yes | Built-in panel shell uses `@affino/menu-vue` surface primitives. |
| `pivotPanel` | yes | yes | Built-in panel shell uses `@affino/menu-vue` surface primitives. |
| `advancedClipboard` | yes | yes | Feature available and installable. |
| `excelCompatibleClipboard` | yes | yes | Feature available and installable. |
| `rowSelectionModes` | yes | yes | Selection behavior now honors mode. |
| `selectionOverlay` | yes | partial | Headless API exists; no default visual overlay component yet. |
| `advancedPivotEngine` | yes | partial | Feature exists; app has no dedicated advanced controls yet. |
| `filterBuilderUI` | yes | yes | JSON-based builder shell uses `@affino/menu-vue` surface primitives. |

## Expansion Pipeline

Phase A delivery status: completed in current branch.

### Phase A: Close wiring gaps first (low risk, fast value)

| Work item | Complexity | Core break risk | Notes |
| --- | --- | --- | --- |
| Fix column virtualization toggle wiring in app feature | S | low | Done: adapter bridges `set/getVirtualizationEnabled` with legacy method names. |
| Make `rowSelectionModes` affect real selection behavior | M | low | Done: row-select payload now supports additive/toggle and honors mode. |
| Promote `aggregationFunctionsRegistry` from local map to integrated resolver path | M | medium | Done: registry now materializes custom handlers into aggregation model. |
| Add built-in app UI shells for `groupPanel`, `pivotPanel`, `filterBuilderUI`, `columnMenu` | M | low | Done: base shells are wired in `<DataGrid />`. |

### Phase B: Query and clipboard power features (medium risk)

| Work item | Complexity | Core break risk | Notes |
| --- | --- | --- | --- |
| Add comparator policy to sort model (per-column comparator id/function resolver) | L | medium | Must preserve deterministic ordering and existing sort model compatibility. |
| Add configurable locale/natural sort strategy | M | medium | Prefer comparator policy extension over ad-hoc flags. |
| Introduce quick/global filter as first-class model contract | L | medium | Integrate with existing filter stage and state import/export. |
| Saved filters/presets state contract | M | low | Can live in `api.state` extension without projection changes. |
| Excel-compatible clipboard payloads (HTML + metadata + formula text) | L | low | Mostly adapter/app and browser clipboard APIs, minimal core change. |
| Real Excel export (`.xlsx`) pipeline | M | low | Adapter-level exporter; core only needs normalized export context. |

### Phase C: Structural core extensions (high risk)

| Work item | Complexity | Core break risk | Notes |
| --- | --- | --- | --- |
| Column groups runtime (nested headers, spans, visibility/order integration) | XL | high | Touches column model snapshot shape, header rendering contracts, state serialization. |
| Row pinning API and projection partitions (top/body/bottom) | L | high | Impacts sort/pagination/group/pivot/virtual window semantics and selection math. |
| Group footers / totals rows | L | high | Adds new row kinds or render metadata, affects projection stages and row identity contracts. |
| Tree data high-level app API and renderer | M | medium | Core is ready; mostly adapter/app contract and UI semantics. |

### Phase D: Devtools and diagnostics productization (medium risk)

| Work item | Complexity | Core break risk | Notes |
| --- | --- | --- | --- |
| Grid inspector panel (state, projection stages, feature status) | M | low | Build on existing `api.diagnostics` and event stream. |
| Feature profiler (timings per stage/event) | L | medium | May require additional internal counters/events in core. |
| Pipeline debugger (recompute reasons and stale stage traces) | L | medium | Expand diagnostics schema while preserving stable API defaults. |

## Recommended execution order

1. Phase B (sort/filter/clipboard power features with minimal projection rewrites).
2. Phase C (core structural changes: column groups, row pinning, group footers).
3. Phase D (devtools after structural APIs are stable).

## Conclusion

The largest true core gaps are:

1. Column groups runtime (not just types).
2. Row pinning/frozen rows semantics.
3. Group footers/totals row model support.
4. Extensible sorting comparator policy (needed for locale/natural/custom sorting).
5. First-class quick/global filter model.

Most other requested items are either already present in core or currently blocked by missing app/UI wiring rather than missing engine primitives.
