# DataGrid Sandbox Demo Audit

Date: 2026-05-24

Perspective: external evaluator opening the sandbox/demo to understand Affino DataGrid quickly.

Goal: make the demo instantly communicate:

- performance
- spreadsheet UX
- server datasource capability
- enterprise quality
- flexibility

Scope reviewed:

- `packages/datagrid-sandbox/src/App.vue`
- `packages/datagrid-sandbox/src/router.ts`
- `packages/datagrid-sandbox/src/components/VueShellGridCard.vue`
- `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
- `packages/datagrid-sandbox/src/components/VueSpreadsheetWorkbookCard.vue`
- `packages/datagrid-sandbox/src/components/VueFormulaGridCard.vue`
- `packages/datagrid-sandbox/src/components/VueGridCard.vue`
- `packages/datagrid-sandbox/src/styles.css`
- `packages/datagrid-sandbox/package.json`
- `packages/datagrid-sandbox/docs/SERVER_DATASOURCE_BACKEND_MIGRATION.md`
- Prior positioning context from `docs/datagrid-positioning-strategy-audit.md`

## Executive Summary

The sandbox has strong raw material: local grids, enterprise app shell, Gantt, timesheet, tree, pivot, worker, server datasource, formulas, cell renderers, row selection, typed facade, spreadsheet workbook, charts, and map demos. It proves engineering depth, but it currently reads as a validation lab rather than a product demo.

The first impression says "Functional sandbox for manual validation and future E2E scenarios." That is accurate for maintainers, but it undersells the product to external engineers. The route list is flat, technical, and overloaded. Several strong demos are hidden behind labels like "Sugar", "Direct API", "Worker", and "Typed Facade" instead of being presented as user outcomes.

The highest ROI change is to keep the sandbox as a validation tool while adding a demo-facing hierarchy:

1. Hero demos for evaluator-visible value.
2. Showcase demos for major capabilities.
3. Advanced/debug demos for maintainers and integration testing.

No large rewrite is needed. This is mostly navigation, copy, grouping, and demo framing.

## 1. Current Sandbox Weaknesses

| Area | Weakness | Why it hurts adoption | Smallest fix |
| --- | --- | --- | --- |
| First impression | Header says the sandbox is for manual validation and E2E scenarios. | External users see an internal test harness, not a product showcase. | Change top copy to explain product value, with a small "debug sandbox" note lower. |
| Navigation | All routes are flat router links with similar visual weight. | Users cannot tell what to click first or which demos matter. | Group links into Hero, Showcases, Advanced, Debug. |
| Default route | `/` redirects to `/vue/base-grid`, the adapter-oriented base demo. | The first view is not the strongest product story. | Redirect to a hero app-grid or showcase landing route. |
| Demo labels | Labels like "Sugar", "Direct API", "Worker", and "Typed Facade" are implementation-centric. | Evaluators do not map these names to value. | Rename visible labels to outcome-based titles while preserving route names if needed. |
| Visual hierarchy | Header/nav occupy attention, but no demo cards explain value or expected interactions. | Users must infer capabilities from controls. | Add demo cards with short descriptions and "try this" steps. |
| Feature overload | `VueShellGridCard` exposes many controls at once: row/col counts, theme, row mode, render, view, placeholder tail, menu preset, pagination, row size, grid lines, saved views, grouping, pivot controls. | Strong flexibility feels like clutter. | Add presets and hide secondary controls behind "Customize". |
| Diagnostics overload | Server datasource page shows a huge diagnostics sidebar with internal plumbing fields. | Enterprise quality is visible, but mixed with debug noise. | Split into summary diagnostics and expandable debug/plumbing sections. |
| Server datasource clarity | Demo says 100k deterministic rows and async range loading, but the sidebar dominates the story. | The unique server-datasource capability is not immediately legible. | Lead with request flow, latency/cache summary, and visible user actions. |
| Spreadsheet UX | Spreadsheet workbook demo is powerful but text-heavy and workbook-internal. | Users may not quickly see selection, formulas, fill, derived sheets, and pivot as the value. | Add a visual task panel: edit source row -> derived sheet updates -> formula result changes. |
| Performance | Performance is implied by row counts, worker mode, and diagnostics, but no hero demo shows smooth scroll or scale clearly. | Evaluators cannot quickly validate performance claims. | Add a performance hero with row/column scale, FPS/latency summary, and jump/scroll actions. |
| Enterprise quality | Enterprise package is used in demos, but capabilities are not packaged as an enterprise story. | Users see license-key/footer text rather than productized enterprise value. | Add an enterprise quality panel: diagnostics, performance preset, formula packs, server consistency. |
| Flexibility | Cell renderer, typed facade, charts, map, shell, app, and core demos exist but are not sequenced. | Flexibility feels like unrelated samples. | Group by integration path: app component, custom cells, headless/runtime, analytics extensions. |
| Debug routes | Core direct API, compute policy, refresh cells, pivot import/export, plumbing diagnostics are useful but too visible. | Beginner path looks complex. | Move under Advanced/Debug group. |
| Screenshots | No obvious screenshot/demo landing composition. | Hard to use sandbox in landing-page or README screenshots. | Create stable hero routes designed for screenshots. |
| Terminology | "Sandbox" is accurate internally but weak externally. | It sets expectation of roughness. | Keep package name, but UI can say "Affino DataGrid Demos". |

## 2. Demos That Should Become Hero Demos

Hero demos should be the first row of the demo experience and should be screenshot-ready. Each should communicate one major product promise within 10 seconds.

| Hero demo | Current source | Why it should be hero | Required framing changes |
| --- | --- | --- | --- |
| Data Workbench Grid | `VueShellGridCard` base mode | Best broad demo: app component, virtualization, column menu, filters, saved views, editing, fill, row selection, themes. | Use curated default controls, professional title, and a "try this" checklist. |
| Server Datasource at Scale | `VueServerDataSourceGridCard` | Strongest enterprise differentiator: backend-owned data, async viewport loading, history, latency, cache, server fill. | Replace always-visible debug wall with summary cards and expandable diagnostics. |
| Spreadsheet Workflow | `VueSpreadsheetWorkbookCard` and formula/fill features | Competes with Handsontable/spreadsheet expectations and shows derived workbook power. | Lead with visible workbook tasks, formula bar, fill handle, derived sheets, pivot sheet. |
| Gantt / Planning View | `VueShellGridCard` with `ganttShowcase` | Highly visual proof of product breadth. | Make it a screenshot-first planning demo with legend and minimal controls. |
| Performance Stress Grid | `VueShellGridCard` with large rows/cols or worker mode | Communicates scale and responsiveness. | Add dedicated route/preset with row/column scale, rendered rows, scroll/jump actions, lightweight perf summary. |

Recommended hero order:

1. Data Workbench Grid
2. Server Datasource at Scale
3. Spreadsheet Workflow
4. Gantt / Planning View
5. Performance Stress Grid

## 3. Demos To Hide Under Advanced/Debug

These demos should remain available, but should not compete with hero demos in the first navigation level.

| Demo | Current route | Recommended group | Reason |
| --- | --- | --- | --- |
| Core Base Direct API | `/core/base-grid` | Debug / Platform API | Important for core validation, not first product impression. |
| Vue Base Adapter | `/vue/base-grid` | Advanced / Adapter | Shows adapter internals more than product value. |
| Vue Base Sugar | `/vue/shell/base-grid` | Showcase or Hero if reframed | The word "Sugar" is unclear; use as Workbench hero after renaming. |
| Vue Worker | `/vue/worker-grid` | Advanced / Performance internals | Worker mode is a scaling path; hero should show outcome, not implementation. |
| Vue Typed Facade | `/vue/typed-facade-grid` | Advanced / Developer ergonomics | Valuable for TS users, but not visual first impression. |
| Vue Cell Renderer | `/vue/cell-renderer-grid` | Advanced / Customization | Good flexibility proof, but should follow base hero. |
| Row Selection Interaction | `/vue/row-selection-grid` | Advanced / Interaction | Useful contract demo, too narrow for top nav. |
| Vue Tree adapter | `/vue/tree-grid` | Showcase / Data modeling | Good feature demo; less important than workbench/server/spreadsheet. |
| Vue Tree Sugar | `/vue/shell/tree-grid` | Showcase / Data modeling | Keep one tree demo visible, hide duplicate. |
| Vue Pivot adapter | `/vue/pivot-grid` | Showcase / Analytics | Keep one pivot demo visible, hide duplicate. |
| Vue Pivot Sugar | `/vue/shell/pivot-grid` | Showcase / Analytics | Prefer app-shell pivot as visible demo. |
| World Map | `/vue/world-map` | Extensions / Advanced | Demonstrates broader packages, not core DataGrid adoption. |
| Charts | `/vue/charts` | Extensions / Advanced | Useful ecosystem demo, not core DataGrid hero. |
| Analytics Charts | `/vue/analytics-charts` | Extensions / Advanced | Strong if tied to DataGrid selection; otherwise secondary. |

## 4. Recommended Onboarding Demo Sequence

The sandbox should guide external users through capability progression.

### Stage 1: Product Value

1. Data Workbench Grid
   - Try sorting, filtering, resizing, selection, copy/paste, fill handle, saved view.
2. Performance Stress Grid
   - Try 100k rows, wide columns, jump to row, horizontal scroll, pinned columns.

### Stage 2: Data Ownership

3. Server Datasource at Scale
   - Try sort/filter, latency profiles, jump to 50k, edit/undo, cache/placeholder visibility.
4. Server Datasource Diagnostics
   - Expand only if evaluating enterprise/server reliability.

### Stage 3: Workflow Depth

5. Spreadsheet Workflow
   - Edit order inputs, watch formulas and derived sheets update.
6. Gantt / Planning View
   - Switch zoom, inspect baseline/critical path/today marker.
7. Pivot / Analytics
   - Change pivot layouts and drill into source rows if available.

### Stage 4: Integration Flexibility

8. Custom Cell Renderer
9. Typed Facade
10. Headless/Adapter Runtime
11. Core Direct API

### Stage 5: Debug/Validation

12. Worker internals
13. Compute policy
14. State import/export
15. Pivot interop JSON
16. Refresh cells
17. Server plumbing diagnostics

## 5. Missing Showcase Scenarios

| Missing scenario | Why it matters | Minimal slice |
| --- | --- | --- |
| Landing demo route | There is no curated start screen with hero cards. | Add `/showcase` route and redirect `/` to it. |
| Screenshot-ready app grid | Current controls make screenshots look like a lab. | Add a preset hero route with limited controls and polished summary cards. |
| Performance hero with visible metrics | Scale is present but not packaged as proof. | Add rows/columns/visible/rendered/latency summary and jump actions. |
| Server request-flow explanation | Server datasource is powerful but diagnostics-heavy. | Add a compact diagram or cards: viewport request -> backend pull -> cache -> grid. |
| Enterprise quality panel | Enterprise features are present but not narrated. | Add summary cards for diagnostics, performance preset, formula packs, server history. |
| Spreadsheet task walkthrough | Workbook demo explains internals in paragraphs. | Add task list: edit qty -> total recalculates -> customer rollup updates -> pivot updates. |
| Gantt product story | Gantt exists, but needs context. | Add planning dataset labels: baseline, critical, delayed, owner, dependency. |
| Saved views story | Saved view controls exist, but not marketed. | Add a visible "Save layout" scenario with before/after copy. |
| Collaboration/server consistency story | Revisions/history/live transport exist in server demo, but hidden in diagnostics. | Add a summary scenario for edit -> server operation -> undo/redo -> revision. |
| Theming/density story | Theme selector exists but not framed as production flexibility. | Add side-by-side theme/density presets or showcase card. |

## 6. Enterprise Capabilities Invisible Or Under-Explained Today

| Capability | Current visibility | Recommended exposure |
| --- | --- | --- |
| Premium diagnostics | `diagnostics` prop and panels exist, but look like raw debug output. | Productize as "Runtime health" summary with expandable raw data. |
| Performance presets | `performance="balanced"` appears in formula demo, but users may not notice. | Add enterprise performance preset selector/status in hero or enterprise panel. |
| Formula packs | `formula-packs` appears as a prop/footer note. | Show a formula-pack example and label it as enterprise extension. |
| Formula runtime controls | `formula-runtime` config exists but invisible to non-readers. | Add summary: cache size, compute strategy, formula diagnostics. |
| Server history | Undo/redo buttons and history diagnostics exist. | Frame as server-backed undo/redo with operation/revision summary. |
| Server fill commit | Present in diagnostics, too buried. | Add user-facing fill scenario with result status. |
| Live update transport | Polling/WebSocket selector exists. | Explain as live update transport with status badge. |
| Placeholder exposure/blank viewport metrics | Visible in diagnostics, but not explained. | Keep summary card: "blank viewport: none", "cache hit: 96%". |
| License behavior | License key is hardcoded; blocked premium requests not visible in primary route. | Add enterprise license status badge and optional invalid-license debug route. |
| Worker/runtime acceleration | Worker route exists separately. | Show as scaling path in performance hero, not as a standalone beginner route. |

## Slice-By-Slice Implementation Roadmap

| Priority | Slice | Change | Type | Validation |
| ---: | --- | --- | --- | --- |
| 1 | Demo index landing | Add `/showcase` route with hero cards and grouped nav; redirect `/` to it. | Sandbox UX | Open sandbox and confirm first screen explains product value in under 30 seconds. |
| 2 | Navigation grouping | Replace flat nav with groups: Hero, Showcase, Advanced, Debug, Extensions. | Sandbox UX | Confirm all existing routes remain reachable. |
| 3 | Rename visible demo labels | Use outcome-based labels: Data Workbench, Server Datasource, Spreadsheet Workflow, Gantt Planning, Performance Stress. | Copy-only | Confirm route paths can stay stable to avoid test churn. |
| 4 | Workbench hero preset | Add curated `VueShellGridCard` preset with fewer controls and a "try this" checklist. | Demo UX | Visual check desktop/mobile; verify grid still supports sort/filter/selection/fill. |
| 5 | Server datasource summary mode | Add summary diagnostics cards and collapse plumbing/debug sections. | Demo UX | Verify server diagnostics data still available under Debug; run existing server datasource tests if touched. |
| 6 | Performance hero | Add dedicated route/preset showing 100k rows or wide columns, jump actions, rendered rows, and lightweight latency/viewport metrics. | Demo UX/perf | Manual scroll/jump visual check; run sandbox type-check. |
| 7 | Spreadsheet walkthrough | Replace paragraph-heavy intro with task checklist and visible outcome labels. | Demo UX | Verify workbook actions still pass existing spreadsheet specs. |
| 8 | Gantt showcase polish | Add concise planning story, legend, and minimal controls; keep advanced knobs hidden. | Demo UX | Visual check that timeline, bars, baseline, critical markers, and today marker are visible. |
| 9 | Enterprise quality panel | Add license/status/performance/diagnostics/formula/server-history summary cards. | Demo UX | Confirm community routes do not imply enterprise is required for basic use. |
| 10 | Advanced/debug consolidation | Move core direct API, adapter, worker, typed facade, row selection, plumbing diagnostics under Advanced/Debug groups. | Navigation | Confirm existing e2e/test route URLs still work. |
| 11 | Screenshot routes | Add stable screenshot-oriented routes for README/landing use. | Demo/docs | Capture desktop screenshots and confirm no debug clutter. |
| 12 | Docs linkback | Add docs page explaining demo sequence and link from README/docs index. | Docs | Check docs links and route names. |

## Expected Adoption Impact

| Time window | Current likely reaction | Expected after roadmap |
| --- | --- | --- |
| First 10 seconds | "This is an internal sandbox." | "This is a serious data-grid product with clear demos." |
| First 1 minute | User scans many technical routes without knowing what matters. | User clicks one of 4-5 hero demos based on their use case. |
| First 3 minutes | User sees controls and diagnostics but must infer value. | User sees performance, spreadsheet UX, server datasource, and Gantt as deliberate product stories. |
| First 5 minutes | User may leave before discovering server/spreadsheet/enterprise depth. | User understands the main differentiators and where to go next. |
| Evaluation phase | Sandbox supports maintainers but is hard to screenshot or share. | Sandbox supports sales/docs screenshots and engineering validation. |

Expected measurable improvements:

- Lower time to discover default app-grid demo.
- Higher visibility of server datasource and spreadsheet workflows.
- Lower perceived complexity from hiding debug routes behind groups.
- Better enterprise signal from summarized diagnostics and performance controls.
- More reusable screenshots for README, landing pages, and release notes.
- Reduced support questions about which demo to open first.

## Recommended Demo Hierarchy

```text
/showcase
  Hero
    Data Workbench Grid
    Server Datasource at Scale
    Spreadsheet Workflow
    Gantt Planning View
    Performance Stress Grid

  Showcase
    Pivot Analytics
    Tree Data
    Timesheet Editing
    Formula Grid
    Custom Cells

  Advanced
    Typed Facade
    Vue Runtime Adapter
    Worker Runtime
    Core Direct API

  Debug
    Server Plumbing Diagnostics
    Compute Policy
    State Import/Export
    Pivot Interop
    Refresh Cells

  Extensions
    Charts
    Analytics Charts
    World Map
```

## Non-Goals

- Do not remove existing validation routes.
- Do not rewrite DataGrid architecture.
- Do not change public package APIs.
- Do not make enterprise required for the community demo path.
- Do not hide diagnostics entirely; summarize first, expand for debug.
