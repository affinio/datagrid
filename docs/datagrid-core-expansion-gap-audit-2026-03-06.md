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
| Column filter UI | present (filter model only) | partial (legacy `useAffinoDataGrid` header filters) | missing | app UI module missing |
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
| Column pinning / visibility / resize / reorder APIs | present | present | partial | app has no built-in interactive header controls |
| Column groups / nested headers / header spans | partial (types only) | missing | missing | core runtime + app header renderer missing |
| Row pinning (top/bottom frozen rows) | partial (`row.state.pinned` type only) | missing | missing | core API/projection behavior missing |
| Row height API | partial (depends on viewport service methods) | partial | partial | app default runtime does not provide full viewport service |
| Column virtualization toggle | partial (viewport has virtualization flag, no stable column toggle API) | partial | partial | app feature currently not wired to stable core service |
| Server-side row model | present | present | partial (via `rowModel` prop) | convenience builder and UI contracts missing |
| Transactions / batch / undo-redo | present | present | present | none |
| Patch/delta pipeline + immutable mode | present | present | present | none |
| Unified state save/restore + migration | present | present | present | none |
| CSV export | partial (text export path) | present | present | good enough for CSV |
| Excel export (`.xlsx`) | missing (native workbook writer) | partial (TSV with xlsx mime) | partial | real workbook export missing |
| Aggregation function registry | partial (custom aggregators per model exist) | partial (local registry map) | partial | registry is not wired as first-class core service |
| Group panel / pivot panel / filter builder UI | missing | partial (headless state features) | missing | default app UI components missing |
| Devtools inspector / profiler / pipeline debugger | partial (`api.diagnostics`) | partial | missing | dedicated devtools package missing |

## Evidence (code pointers)

- Core API contracts: `packages/datagrid-core/src/core/gridApiContracts.ts`
- Sort behavior and multi-column descriptors: `packages/datagrid-core/src/models/clientRowProjectionPrimitives.ts`
- Tree/pivot/group/aggregation model contracts: `packages/datagrid-core/src/models/rowModel.ts`
- Group projection and aggregate patching: `packages/datagrid-core/src/models/groupProjectionController.ts`, `packages/datagrid-core/src/models/clientRowProjectionAggregateStage.ts`
- Unified state API: `packages/datagrid-core/src/core/gridApiStateMethods.ts`, `packages/datagrid-core/src/core/gridApiContracts.ts`
- Runtime transactions: `packages/datagrid-core/src/core/gridApiTransactionMethods.ts`
- App feature registry and current wrapper behavior: `packages/datagrid-vue/src/composables/useDataGridFeatureRegistry.ts`
- Current app shell renderer: `packages/datagrid-vue/src/components/DataGrid.vue`, `GridHeader.vue`, `GridBody.vue`, `GridRow.vue`, `GridCell.vue`
- Quick filter helper scope: `packages/datagrid-orchestration/src/useDataGridQuickFilterActions.ts`

## Expansion Pipeline

### Phase A: Close wiring gaps first (low risk, fast value)

| Work item | Complexity | Core break risk | Notes |
| --- | --- | --- | --- |
| Fix column virtualization toggle wiring in app feature | S | low | Align app feature with stable viewport service API (`setVirtualizationEnabled`) or add adapter bridge. |
| Make `rowSelectionModes` affect real selection behavior | M | low | Current mode is local state only. |
| Promote `aggregationFunctionsRegistry` from local map to integrated resolver path | M | medium | Keep backward compatibility with existing aggregation model. |
| Add built-in app UI shells for `groupPanel`, `pivotPanel`, `filterBuilderUI`, `columnMenu` | M | low | Mostly app-level components; minimal core impact. |

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

1. Phase A (stabilize app wiring and headless-to-UI gaps).
2. Phase B (sort/filter/clipboard power features with minimal projection rewrites).
3. Phase C (core structural changes: column groups, row pinning, group footers).
4. Phase D (devtools after structural APIs are stable).

## Conclusion

The largest true core gaps are:

1. Column groups runtime (not just types).
2. Row pinning/frozen rows semantics.
3. Group footers/totals row model support.
4. Extensible sorting comparator policy (needed for locale/natural/custom sorting).
5. First-class quick/global filter model.

Most other requested items are either already present in core or currently blocked by missing app/UI wiring rather than missing engine primitives.
