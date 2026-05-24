# DataGrid Showcase Demo Plan

Status: planned slice, no UI implementation yet.
Date: 2026-05-24
Scope: `packages/datagrid-sandbox` route and navigation productization.

## Implementation Status

- 2026-05-24: Slice 7 split the product-shaped showcase into private package `@affino/datagrid-showcase`, independent from sandbox validation/debug components.
- 2026-05-24: Slice 6 added an additive `/showcase` landing route, grouped sandbox navigation, and outcome-based demo labels.
- Existing route paths and the `/` redirect to `/vue/base-grid` remain unchanged.
- Hero cards currently link to existing stable routes; `/showcase/*` aliases remain a follow-up slice.

## Goal

Turn the sandbox from a flat validation lab into an external demo experience that communicates performance, spreadsheet UX, server datasource capability, enterprise quality, and flexibility while preserving all existing validation and debug routes.

This plan is intentionally additive. Existing routes stay available for tests and internal workflows. New showcase routes should wrap or preset existing demos instead of replacing the current implementation.

## Current Route Audit

Current entry behavior:

- `/` redirects to `/vue/base-grid`.
- Top navigation is flat and labeled as a sandbox for manual validation.
- Debug, adapter, enterprise, extension, and showcase demos have equal visual weight.

Existing routes:

| Route | Current component/preset | Current external impression | Recommended group |
| --- | --- | --- | --- |
| `/core/base-grid` | `CoreGridCard` | Core direct API validation | Debug |
| `/vue/base-grid` | `VueGridCard`, base | Adapter baseline and e2e workhorse | Advanced / Debug |
| `/vue/tree-grid` | `VueGridCard`, tree | Tree feature validation | Showcase |
| `/vue/pivot-grid` | `VueGridCard`, pivot | Pivot feature validation | Showcase |
| `/vue/worker-grid` | `VueGridCard`, worker | Worker/scaling internals | Advanced |
| `/vue/server-data-source-grid` | `VueServerDataSourceGridCard` | Strong backend-owned data proof, currently buried | Hero |
| `/vue/formula-grid` | `VueFormulaGridCard` | Formula feature validation | Showcase |
| `/vue/cell-renderer-grid` | `VueCellRendererGridCard` | Custom rendering proof | Advanced |
| `/vue/row-selection-grid` | `VueRowSelectionInteractionGridCard` | Selection contract validation | Debug |
| `/vue/typed-facade-grid` | `VueTypedFacadeGridCard` | TypeScript facade proof | Advanced |
| `/vue/spreadsheet-workbook` | `VueSpreadsheetWorkbookCard` | Spreadsheet/workbook workflow | Hero |
| `/vue/world-map` | `WorldMapDemo` | Ecosystem extension | Extensions |
| `/vue/charts` | `ChartsDemo` | Ecosystem extension | Extensions |
| `/vue/analytics-charts` | `AnalyticsChartsDemo` | Analytics extension | Extensions |
| `/vue/base-grid-factory` | redirect to `/vue/shell/base-grid` | Legacy alias | Debug |
| `/vue/shell/base-grid` | `VueShellGridCard`, base | Best ready app-grid starting point, label is internal | Hero |
| `/vue/shell/grouped-grid` | `VueShellGridCard`, grouped | Useful grouping showcase, absent from current nav | Showcase |
| `/vue/shell/gantt-grid` | `VueShellGridCard`, Gantt preset | Visual enterprise planning proof | Hero |
| `/vue/shell/timesheet-grid` | `VueShellGridCard`, timesheet preset | Enterprise planning/timesheet proof | Showcase |
| `/vue/shell/tree-grid` | `VueShellGridCard`, tree | App-shell tree duplicate | Showcase |
| `/vue/shell/pivot-grid` | `VueShellGridCard`, pivot | App-shell pivot duplicate | Showcase |

## Target Route Groups

### Hero

Hero routes are the first five external demos. They should have product names, short outcome copy, and visible scenario controls, while reusing existing grid components wherever possible.

| Hero demo | Preferred route | Backing route/component | Purpose |
| --- | --- | --- | --- |
| Data Workbench Grid | `/showcase/workbench` | `VueShellGridCard` base preset | Shows the normal app-layer grid external users should evaluate first. |
| Server Datasource at Scale | `/showcase/server-datasource` | `VueServerDataSourceGridCard` | Shows backend-owned data, lazy loading, grouping, edits, and scale. |
| Spreadsheet Workflow | `/showcase/spreadsheet` | `VueSpreadsheetWorkbookCard` | Shows spreadsheet-like editing, formulas, sheets, fill, and workflow depth. |
| Gantt Planning | `/showcase/gantt` | `VueShellGridCard` Gantt preset | Shows enterprise planning and non-table view modes. |
| Performance Stress Grid | `/showcase/performance-stress` | Existing base/worker grid with a large preset | Shows virtualization and responsiveness as an outcome, not as worker plumbing. |

### Showcase

Feature-oriented demos that are useful after the hero path:

- `/vue/shell/grouped-grid`
- `/vue/shell/tree-grid`
- `/vue/shell/pivot-grid`
- `/vue/shell/timesheet-grid`
- `/vue/tree-grid`
- `/vue/pivot-grid`
- `/vue/formula-grid`

Prefer app-shell routes in visible navigation when both adapter and app-shell versions exist. Keep adapter routes stable for validation.

### Advanced

Developer-facing or integration-facing demos that should not lead first-time evaluation:

- `/vue/worker-grid`
- `/vue/cell-renderer-grid`
- `/vue/typed-facade-grid`
- `/vue/base-grid`

### Debug

Validation routes that must remain easy for maintainers and tests but should not read as the product tour:

- `/core/base-grid`
- `/vue/base-grid-factory`
- `/vue/row-selection-grid`
- direct query-param variants of `/vue/base-grid`
- direct query-param variants of `/vue/server-data-source-grid`

### Extensions

Adjacent ecosystem demos:

- `/vue/world-map`
- `/vue/charts`
- `/vue/analytics-charts`

## `/showcase` Landing Route

Add `/showcase` as an additive landing route. Do not change the root redirect in the first implementation slice unless e2e route assumptions are updated at the same time.

Landing route content should be minimal:

- Five hero demo tiles in this order: Data Workbench Grid, Server Datasource at Scale, Spreadsheet Workflow, Gantt Planning, Performance Stress Grid.
- Compact group navigation: Hero, Showcase, Advanced, Debug, Extensions.
- Each hero tile should state the scenario and the existing route it opens.
- Keep diagnostics and validation language out of the hero copy; expose it in Advanced/Debug groups.

Possible later root behavior:

- Keep `/` redirecting to `/vue/base-grid` until tests are audited.
- After tests are stable, consider redirecting `/` to `/showcase` or adding a home link to `/showcase` without breaking direct test routes.

## Minimal Implementation Slices

| Slice | Change | Files likely touched | Validation |
| --- | --- | --- | --- |
| 5.1 | Add route metadata and group model for existing routes without visual redesign. | `packages/datagrid-sandbox/src/router.ts`, small route metadata helper if needed | Type-check sandbox; verify every existing route still resolves. |
| 5.2 | Add `/showcase` landing route with hero cards that link to existing routes. | New showcase landing component, router registration | Playwright smoke: `/showcase` renders five hero links; links navigate. |
| 5.3 | Reorganize sandbox navigation into Hero / Showcase / Advanced / Debug / Extensions. | `packages/datagrid-sandbox/src/App.vue`, styles | Visual smoke at desktop/mobile; existing route links still visible or discoverable. |
| 5.4 | Add additive hero aliases under `/showcase/*` for the five hero demos. | `router.ts`, optional preset wrappers | Existing routes and new aliases both render expected demos. |
| 5.5 | Add Performance Stress Grid preset using existing grid/worker primitives. | Router props or small preset wrapper only | Scroll smoke with large row/col preset; no blank gaps; perf trace route still works. |
| 5.6 | Move debug diagnostics copy below the fold or behind Debug group labels. | App/nav component and demo copy only | Confirm diagnostics panels still open; e2e selectors unchanged. |

## Validation Per Slice

### Slice 5.1 Route Metadata

- `pnpm --filter @affino/datagrid-sandbox typecheck` if available.
- `pnpm exec playwright test e2e/sandbox-grid.spec.ts --grep "baseline|server"` or the smallest stable route smoke available.
- Manual route list check: every route in the current audit table still appears in router config.

### Slice 5.2 Showcase Landing

- `/showcase` renders without loading a heavy grid by default.
- Hero links exist for all five required demos.
- Keyboard tab order reaches all hero links.
- No existing e2e route changes.

### Slice 5.3 Navigation Grouping

- Desktop and mobile nav expose Hero, Showcase, Advanced, Debug, Extensions.
- Debug routes remain reachable without URL guessing.
- Link text avoids internal labels such as "Sugar" in external-facing groups.
- Existing route paths remain unchanged.

### Slice 5.4 Hero Aliases

- `/showcase/workbench` renders the same scenario as `/vue/shell/base-grid` with external naming.
- `/showcase/server-datasource` renders the same scenario as `/vue/server-data-source-grid`.
- `/showcase/spreadsheet` renders the same scenario as `/vue/spreadsheet-workbook`.
- `/showcase/gantt` renders the same scenario as `/vue/shell/gantt-grid`.
- `/showcase/performance-stress` renders a large-scale preset without changing `/vue/worker-grid` semantics.

### Slice 5.5 Performance Stress Grid

- Verify initial render is nonblank.
- Verify vertical and horizontal scroll remain responsive.
- Verify pinned/header alignment if enabled.
- Verify perf diagnostics remain opt-in or compact enough for a demo route.

### Slice 5.6 Debug Copy Consolidation

- Debug labels still expose validation routes for maintainers.
- No e2e selectors or component class names are renamed unless tests are updated in the same slice.
- External first screen does not lead with diagnostics, protocol internals, or adapter terminology.

## Routes That Must Remain Stable For Tests

These paths are referenced by e2e specs or are core validation entrypoints. Do not remove, rename, or change their default behavior in showcase slices:

- `/core/base-grid`
- `/vue/base-grid`
- `/vue/base-grid?rows=1000&cols=32`
- `/vue/base-grid?rows=50000`
- `/vue/base-grid?rows=10000`
- `/vue/base-grid?rows=1000&cols=1000`
- `/vue/base-grid?rows=50000&cols=128`
- `/vue/base-grid?dgPerfTrace=1`
- `/vue/tree-grid`
- `/vue/pivot-grid`
- `/vue/shell/base-grid`
- `/vue/server-data-source-grid?datasource=fake`

Also preserve these existing routes as stable manual validation routes unless a future slice explicitly updates docs and tests:

- `/vue/worker-grid`
- `/vue/formula-grid`
- `/vue/cell-renderer-grid`
- `/vue/row-selection-grid`
- `/vue/typed-facade-grid`
- `/vue/spreadsheet-workbook`
- `/vue/world-map`
- `/vue/charts`
- `/vue/analytics-charts`
- `/vue/base-grid-factory`
- `/vue/shell/grouped-grid`
- `/vue/shell/gantt-grid`
- `/vue/shell/timesheet-grid`
- `/vue/shell/tree-grid`
- `/vue/shell/pivot-grid`

## Adoption Impact

Expected improvement after the first two implementation slices:

- First-time evaluators see the product story before internal validation surfaces.
- Server datasource, spreadsheet workflow, Gantt, and performance become discoverable in one click.
- Existing tests and maintainer workflows keep their direct routes.
- External naming shifts from implementation terms to outcomes without changing architecture boundaries.

## Open Risks

- Standalone product showcase now lives in `packages/datagrid-showcase`; sandbox `/showcase` remains a validation-adjacent landing until it is redirected or deprecated in a later slice.
- Root redirect change may break tests or expectations; keep it out of the first UI slice.
- Performance Stress Grid needs a careful preset so it demonstrates scale without making `/showcase` heavy.
- Duplicate tree/pivot routes need naming discipline; avoid hiding adapter routes from maintainers.
- Any selector/class cleanup should be a separate test-aware slice, not part of the showcase landing work.
