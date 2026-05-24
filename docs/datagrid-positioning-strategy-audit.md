# DataGrid Positioning Strategy Audit

Date: 2026-05-24

Perspective: senior developer-tools product strategy.

Scope read before this audit:

- `docs/datagrid-product-report.ru.md`
- `docs/datagrid-feature-catalog.md`
- `README.md`
- `docs/datagrid-vue-app-community-vs-enterprise.md`
- `docs/datagrid-formula-engine-community-vs-enterprise.md`
- `docs/datagrid-pivot-community-vs-enterprise.md`

Market references checked:

- AG Grid: https://www.ag-grid.com/javascript-data-grid/key-features/
- AG Grid GitHub: https://github.com/ag-grid/ag-grid
- TanStack Table: https://tanstack.com/table
- TanStack Table guide: https://tanstack.dev/table/latest/docs/guide/tables
- Handsontable: https://handsontable.com/
- Handsontable docs: https://handsontable.com/docs/javascript-data-grid/
- Glide Data Grid: https://grid.glideapps.com/
- Glide Data Grid GitHub: https://github.com/glideapps/glide-data-grid

## Executive Summary

Affino DataGrid is not best positioned as another generic JavaScript table. Its strongest product shape is a Vue-first data workbench grid for applications where the grid is the primary workflow surface: editing, selection, clipboard, formulas, pivot/group/filter, saved views, virtualized rendering, and backend-owned datasets.

The current documentation proves technical depth, but the positioning is too internal. It talks like a monorepo, benchmark harness, and architecture inventory before it talks like a product. Against AG Grid, TanStack Table, Handsontable, Glide Data Grid, and spreadsheet-style runtimes, Affino's strongest differentiator is the combination of deterministic runtime contracts, app-facing Vue UX, spreadsheet-like workflows, and server datasource integration. The weakest area is external clarity: an evaluator cannot quickly understand the category, package choice, OSS/enterprise boundary, or what visual experience they get.

Recommended category statement:

> Affino DataGrid is a Vue-first data workbench grid for product teams building data-heavy operational screens, combining a ready app component, deterministic headless runtime, spreadsheet-like editing, analytics projections, and backend-owned datasource contracts.

## 1. What The Product Actually Is

Affino DataGrid is a product-grid platform, not just a UI table component.

It contains these product layers:

- app-facing Vue component: `@affino/datagrid-vue-app`
- Vue runtime/headless adapter: `@affino/datagrid-vue`
- deterministic core contracts: `@affino/datagrid-core`
- orchestration and interaction primitives
- server datasource adapters and backend integration docs
- formula engine boundary
- pivot boundary
- optional enterprise app/runtime/tooling packages

The most accurate external description:

> A high-performance, Vue-first DataGrid for applications where users actively work in the grid, not just view rows.

The product is strongest when the table is the main application surface:

- operational back-office grids
- analytics workbenches
- data-entry and review screens
- financial/planning interfaces
- admin consoles with large remote datasets
- spreadsheet-like but domain-specific product workflows

It is not best framed as:

- a small table component
- a pure spreadsheet engine
- a pure headless table utility
- a React canvas performance grid
- a generic AG Grid clone

## 2. What Category It Belongs To

Primary category:

- developer DataGrid component/platform for data-heavy Vue applications

More precise category:

- app-facing data workbench grid with deterministic runtime and server datasource contracts

Competitive position:

| Product | Primary category | Buyer expectation | Affino relationship |
| --- | --- | --- | --- |
| AG Grid | enterprise JavaScript DataGrid | mature all-purpose grid with many enterprise features and broad framework coverage | Affino should not out-AG-Grid AG Grid; compete on Vue-first product workflow, deterministic contracts, and server datasource clarity. |
| TanStack Table | headless table logic | maximum UI control with no rendered grid | Affino is higher-level and more product-shaped; position as ready UX plus headless escape hatch, not just table logic. |
| Handsontable | spreadsheet-like JavaScript DataGrid | Excel-like editing, formulas, clipboard, familiar grid behavior | Affino overlaps on spreadsheet-like UX, but should position as product data workbench, not full spreadsheet replacement. |
| Glide Data Grid | high-performance React canvas grid | fast rendering, millions of rows, native scrolling, rich cells | Affino should not lead with raw canvas speed; lead with full workflow stack, Vue, server data, and deterministic behavior. |
| Spreadsheet runtimes | workbook/formula/sheet engines | sheets, formulas, ranges, workbook semantics, collaboration | Affino can integrate spreadsheet-like workflows, but should avoid claiming full spreadsheet semantics unless the workbook surface supports them. |

Best category phrase for landing page:

> The DataGrid for data-heavy Vue products.

Best expanded category phrase:

> A Vue-first data workbench grid with virtualized rendering, spreadsheet-like editing, analytics projections, and backend-owned datasource support.

## 3. Strongest Differentiators

### 1. Product-workflow breadth in one architecture

Affino combines capabilities that are often split across separate libraries:

- virtualized grid rendering
- selection and range interactions
- clipboard and fill handle
- inline editing and undo/redo
- sorting/filtering/grouping/pivot
- saved state/views
- formulas
- server datasource protocol
- Gantt entrypoint

This is more product-shaped than TanStack Table and more workflow-integrated than a pure rendering grid.

### 2. Vue app facade plus headless/runtime escape hatch

The package stack can serve two audiences:

- application teams that want `<DataGrid />`
- platform teams that need runtime control through `@affino/datagrid-vue` and `@affino/datagrid-core`

This is a strong middle position between Handsontable-style ready component and TanStack-style headless utility.

### 3. Deterministic core philosophy

The docs emphasize stable APIs, event order, snapshot isolation, revisions, projection lifecycle, and contract tests. This is a serious enterprise developer-tools signal and should be marketed as predictability, not as internal machinery.

Suggested external wording:

> Built for teams that need predictable grid behavior under editing, virtualization, server refreshes, and saved-state restore.

### 4. Server datasource integration is unusually product-relevant

The server datasource docs describe pull, histogram, edits, fill, history, invalidation, revisions, and consistency. This is a major differentiator for real products with backend-owned data. It should be visible from the landing page.

### 5. OSS/enterprise boundary is philosophically strong

The community-vs-enterprise docs preserve base usability in community packages and reserve expensive runtime/tooling/scaling features for enterprise. This is healthier than gating basic adoption features.

### 6. Spreadsheet-like workflows without pretending to be Excel

Selection, clipboard, fill handle, placeholder rows, formulas, and history are valuable for operational apps. Affino should own the phrase "spreadsheet-like product workflows" while explicitly avoiding full spreadsheet replacement claims.

## 4. Weakest Positioning Areas

### 1. Root README does not position the product

The current README starts with monorepo structure, package names, setup commands, benchmark commands, and performance tables. It does not quickly say what the product is, who should use it, or how to render a grid.

### 2. Package story is confusing

The feature catalog lists `@affino/datagrid` as an app-team package, while the actual repo package list does not show that package. Root README omits `@affino/datagrid-vue-app` even though product docs recommend it as the main app entrypoint.

### 3. Affino sounds smaller than it is

The docs have strong capabilities, but they are hidden behind inventory-style documentation. The product should feel like a serious data-workbench grid, not an internal package collection.

### 4. Spreadsheet positioning is ambiguous

Docs mention spreadsheet-like flows and formula engine strength, while other package docs say Affino is not intended to be a spreadsheet editor. That distinction is correct, but it needs earlier, cleaner messaging:

> Spreadsheet-like workflows for product grids, not a full workbook replacement.

### 5. Gantt is under-discovered

Gantt exists as an app entrypoint/view mode, but it is not visible in the root README and is buried in long package docs. This is a meaningful product capability and should get a small screenshot/example card.

### 6. Server datasource is too hidden for how valuable it is

The server datasource integration kit is one of the strongest enterprise differentiators. It should be in the top-level landing flow, not only inside `docs/server-datasource/`.

### 7. Enterprise positioning is implementation-first

The OSS vs enterprise docs are useful internally, but they read like release engineering notes. External enterprise positioning should be buyer-oriented:

- community: complete app grid for product teams
- enterprise: scaling, diagnostics, premium formulas, worker/performance presets, advanced runtime tooling

## 5. Messaging Mistakes

| Mistake | Why it hurts | Fix |
| --- | --- | --- |
| Leading with "Monorepo" | External engineers evaluate product value first, repo structure later. | Lead with product category and use cases. |
| Leading with benchmarks | Performance matters, but raw benchmark tables before use case clarity feel internal. | Use one short performance claim, link full benchmark docs. |
| Listing package internals first | Users do not yet know which package they need. | Add "Start with `@affino/datagrid-vue-app`" before package inventory. |
| Mentioning `@affino/datagrid` as app package if not published | Creates install confusion. | Remove or explicitly mark as planned. |
| Overusing capability inventory | Feature matrix is useful after category fit, not before. | Add scenario-based summary before matrix. |
| Stable/advanced terminology appears before user intent | New users do not know whether they are stable or advanced. | Explain by job: app component, headless runtime, custom renderer. |
| Spreadsheet claims lack a crisp boundary | Can attract wrong expectations from Excel/Sheets users. | Say "spreadsheet-like product workflows, not a workbook clone." |
| OSS/enterprise docs talk package mechanics first | Buyers need value boundary, not internal migration pipeline. | Add public-facing OSS/enterprise page. |

## 6. Features Overexposed Too Early

These are valuable, but should be moved out of first-screen adoption messaging:

- benchmark command inventory
- full performance snapshot table
- tree scale envelope
- event ordering guarantees
- deterministic reentrancy queue
- lifecycle helpers
- diagnostics snapshots
- plugin sandbox contracts
- advanced runtime plugin hooks
- worker protocol details
- low-level server client APIs
- internal enterprise package dependency rules
- implementation pipeline checklists
- removed legacy aliases

These should live in advanced docs, contributor docs, architecture docs, or enterprise technical references.

## 7. Features Under-Marketed

### Server datasource

This is the strongest enterprise-oriented differentiator. Market it as:

> Backend-owned grids without inventing your own grid protocol.

Expose:

- viewport pulls
- server sort/filter
- histograms
- edits/fill/history paths
- revisions and invalidation
- cache windows and placeholders

### Saved views and state restore

This is a product feature, not just state API. Market it as:

> Save and restore user grid layouts, filters, selection, view mode, and runtime state.

### Spreadsheet-like editing

Selection, clipboard, fill, range move, placeholder rows, and undo/redo should be grouped as one product story.

### Deterministic runtime contracts

This should be translated from internal language into product trust:

> Predictable behavior under edits, scrolling, server refreshes, and state restore.

### Gantt

Gantt is a visible, demo-friendly capability. Even if not the main category, it increases perceived product breadth.

### Vue-first app facade

Do not bury the fact that ordinary Vue teams can start with one component.

### Community package usefulness

Community has real value: DataGrid, column menu, column layout, advanced filter, aggregations, base formula usage, saved views, toolbar customization. This should be explicit.

## 8. Recommended Landing-Page Messaging Hierarchy

### Hero

Headline:

> The DataGrid for data-heavy Vue products.

Subhead:

> Affino DataGrid combines a ready Vue component, deterministic runtime, virtualized rendering, spreadsheet-like editing, analytics projections, and backend-owned datasource support.

Primary CTA:

- Get started in 5 minutes

Secondary CTA:

- Explore server datasource

### First Screen Proof

Show a real grid screenshot or animated demo with:

- virtualized rows
- column resize/menu
- selection range
- filter/sort
- fill handle or edit state

### Problem Section

Message:

> Product grids become application infrastructure fast.

Bullets:

- scrolling and pinned panes
- selection overlays
- clipboard and editing
- undo/redo
- server refresh consistency
- saved views
- formulas and pivot/group/filter

### Solution Section

Message:

> Affino gives you the grid workflow stack in one architecture.

Use three columns:

1. Ready app UX: `@affino/datagrid-vue-app`
2. Deterministic runtime: `@affino/datagrid-core` / `@affino/datagrid-vue`
3. Backend-owned data: server datasource adapters and protocol

### Package Choice Section

| Need | Start with |
| --- | --- |
| Vue app grid | `@affino/datagrid-vue-app` |
| Custom Vue runtime or renderer | `@affino/datagrid-vue` |
| Backend-owned rows | `@affino/datagrid-server-adapters` + datasource row model |
| Formula APIs | `@affino/datagrid-formula-engine` |
| Pivot contracts | `@affino/datagrid-pivot` |
| Enterprise tooling/scaling | enterprise app/runtime packages |

### Capability Section

Group by user outcome, not implementation:

- Work with large data
- Edit like a spreadsheet
- Analyze in place
- Persist user views
- Connect to backend data
- Scale with enterprise runtime controls

### OSS vs Enterprise Section

Short, public-facing, value-based table:

| Community | Enterprise |
| --- | --- |
| Production-useful DataGrid app component | Premium diagnostics/profiler UI |
| Sorting, filtering, grouping, aggregations | Worker/performance presets |
| Selection, clipboard, editing, fill basics | Premium formula packs/runtime controls |
| Saved views and app toolbar extension | High-scale pivot/formula acceleration |
| Base formula and pivot contracts | Enterprise support and scaling guidance |

### Final CTA

- Start with local rows
- Start with server datasource
- Compare capabilities

## 9. Recommended OSS vs Enterprise Positioning

### Community Positioning

Community should feel complete for normal product teams.

Message:

> The community packages are production-useful: render a real Vue DataGrid, sort/filter/group, edit cells, persist state, customize toolbars, and use base formula/pivot contracts.

Keep community value obvious:

- `DataGrid` component
- virtualization
- column menu/layout
- advanced filter
- aggregations
- selection/editing/clipboard/fill basics
- saved views
- base formula parsing/diagnostics/contracts
- base pivot contracts/helpers
- toolbar customization

Do not position community as a toy/demo tier.

### Enterprise Positioning

Enterprise should monetize expensive runtime/tooling/scaling layers, not basic usability.

Message:

> Enterprise adds operational confidence and high-scale controls for teams running complex grids in production.

Enterprise value pillars:

- diagnostics and profiler UI
- premium formula packs
- formula runtime controls
- worker/performance presets
- high-cardinality pivot acceleration
- advanced explain tooling
- enterprise support and release guidance
- future collaboration/audit/high-scale snapshot tooling

### Boundary Principle

Good public wording:

> Community gives teams the complete grid foundation. Enterprise adds the tooling and runtime controls for the hardest production workloads.

Avoid wording that implies:

- community is incomplete
- common filtering/editing requires enterprise
- formulas are enterprise-only
- pivot is enterprise-only
- server data is enterprise-only unless that is an explicit business decision

## Prioritized Positioning Improvement Roadmap

| Priority | Slice | Why it matters | Measurable outcome |
| ---: | --- | --- | --- |
| 1 | Rewrite root README hero and first 5-minute path around `@affino/datagrid-vue-app`. | Fixes first impression and package choice. | New user can identify default package and render a grid in 5 minutes. |
| 2 | Remove or clarify `@affino/datagrid` from package maps unless published. | Prevents install confusion. | No misleading primary package references in docs. |
| 3 | Add landing-page package choice table. | Turns architecture into a simple decision. | User can choose app/runtime/server/formula/pivot path in under 1 minute. |
| 4 | Add server datasource callout to root README. | Surfaces a major differentiator. | README links directly to server datasource quick start. |
| 5 | Add public OSS vs enterprise value table. | Makes monetization boundary credible. | Community feels useful; enterprise value is additive. |
| 6 | Add scenario-based capability summary before feature catalog matrix. | Reduces inventory fatigue. | Evaluators see use-case fit before API detail. |
| 7 | Add spreadsheet-like workflow section with explicit boundary. | Captures value without overclaiming. | Docs distinguish product-grid workflows from workbook replacement. |
| 8 | Add Gantt screenshot/example card. | Increases visible product breadth. | Gantt discoverable from root README or landing page. |
| 9 | Move benchmark-heavy README content into perf docs. | Keeps landing flow focused. | First screen no longer dominated by maintainer/perf internals. |
| 10 | Create competitor-aware positioning page. | Helps sales/docs/release messaging stay consistent. | Internal teams reuse one narrative for AG Grid/TanStack/Handsontable/Glide comparisons. |

## Minimal Documentation Slices

### Slice 1: Root README Product Opening

Add:

- category statement
- 5-minute quick start
- package choice table
- short mental model diagram

Move down:

- benchmark tables
- monorepo command lists
- internal package inventory

### Slice 2: Package Map Cleanup

Create or update `docs/datagrid-package-map.md` with:

- public package names
- intended consumer
- install command
- stable/advanced status
- enterprise/community status

### Slice 3: Public OSS vs Enterprise Page

Create `docs/datagrid-community-vs-enterprise.md` as a public-facing summary that links to implementation-specific boundary docs.

Include:

- community value promise
- enterprise value promise
- feature boundary table
- upgrade path
- guardrails

### Slice 4: Server Datasource Landing Callout

Add a short root README section:

- when to use server datasource
- one endpoint minimal contract
- link to quick start
- link to protocol only after quick start

### Slice 5: Spreadsheet-Like Workflow Page

Create or update a concise doc explaining:

- selection
- fill handle
- clipboard
- editing
- undo/redo
- formulas
- what is not a full spreadsheet/workbook replacement

### Slice 6: Gantt Discoverability

Add a root README card and one minimal code example linking to `docs/datagrid-gantt.md`.

### Slice 7: Feature Catalog Reframe

Add a top section to `docs/datagrid-feature-catalog.md`:

- choose by scenario
- what is app-level vs runtime-level vs backend-owned
- link to package map

## Examples, Screenshots, And Demo Priorities

### Priority 1: Default App Grid Screenshot

Show:

- rows and columns
- selection range
- column menu/filter
- resize affordance
- compact professional styling

Purpose:

- prove this is a real app component, not only headless primitives

### Priority 2: 5-Minute Local Rows Demo

Small runnable Vite/Vue example with:

- install command
- local rows
- sortable/filterable columns
- state persistence optional

Purpose:

- shorten time to first success

### Priority 3: Server Datasource Demo

Show:

- backend-owned pull
- sort/filter request flow
- loading placeholders
- histogram/value filter if available

Purpose:

- differentiate from client-only grids

### Priority 4: Spreadsheet Workflow Demo

Show:

- range selection
- copy/paste
- fill handle
- undo/redo
- placeholder row materialization

Purpose:

- compete with Handsontable-style expectations without overclaiming workbook parity

### Priority 5: Gantt Demo

Show:

- split table/timeline
- `view-mode="gantt"`
- minimal task data

Purpose:

- make product breadth visible

### Priority 6: Enterprise Diagnostics Demo

Show only after community value is established:

- diagnostics/profiler module
- formula runtime controls
- performance preset selection
- blocked premium request messaging

Purpose:

- make enterprise additive and defensible

## Recommended Competitive Messaging

### Against AG Grid

Do not claim more features. Claim clearer product workflow for Vue and backend-owned grids.

Suggested message:

> Choose Affino when you want a Vue-first grid workflow stack with deterministic runtime contracts and server datasource integration, not just a large feature catalog.

### Against TanStack Table

Do not compete as a smaller headless utility. Position as ready UX plus headless control.

Suggested message:

> TanStack gives you table logic. Affino gives you a ready grid experience with a deterministic runtime underneath when you need to go deeper.

### Against Handsontable

Do not claim full spreadsheet replacement. Position as spreadsheet-like workflows inside domain apps.

Suggested message:

> Affino brings spreadsheet-like editing, selection, clipboard, fill, formulas, and history into product grids without forcing a workbook-first model.

### Against Glide Data Grid

Do not compete only on rendering speed. Position as workflow and server-data stack.

Suggested message:

> Glide optimizes canvas grid rendering. Affino focuses on the full data-workflow surface: app component, runtime contracts, editing, analytics, saved state, and server datasource integration.

### Against Spreadsheet Runtimes

Be precise about boundaries.

Suggested message:

> Affino is for product grids that need spreadsheet-like workflows. Use a dedicated spreadsheet runtime when workbook semantics, sheet formulas, A1 ranges, and spreadsheet file compatibility are the core product.

## Key Landing Page Copy Blocks

### Short Pitch

Affino DataGrid is a Vue-first DataGrid for data-heavy products. It gives teams a ready app component, deterministic runtime contracts, virtualized rendering, spreadsheet-like editing, analytics projections, and backend-owned datasource integration.

### Long Pitch

Most product grids start as tables and become application infrastructure: scrolling, selection, editing, clipboard, undo/redo, saved views, filters, formulas, pivot views, server refreshes, and performance budgets. Affino DataGrid packages those concerns into one architecture so teams can build data-heavy workflows without inventing their own grid platform.

### OSS/Enterprise Pitch

Community gives teams the complete grid foundation. Enterprise adds premium diagnostics, runtime controls, scaling presets, formula packs, and high-scale optimization layers for the hardest production workloads.
