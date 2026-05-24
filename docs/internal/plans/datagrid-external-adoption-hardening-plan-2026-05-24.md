# DataGrid External Adoption Hardening Plan

Date: 2026-05-24

Purpose: raise external adoption and beginner usability without changing core architecture or adding new runtime features.

Current bottleneck: Affino DataGrid is technically strong, but first-time adoption is weak because README, package choice, demo flow, stable API narrative, and OSS trust layer are not productized enough.

## Constraints

- Do not redesign core runtime.
- Do not add new grid features unless explicitly required by the current slice.
- Prefer docs, examples, demo navigation, and onboarding improvements.
- Preserve stable / advanced / internal API tiering.
- Preserve community vs enterprise boundaries.
- Keep changes minimal and reviewable.
- Work slice-by-slice; do not implement the whole roadmap in one change.

## Required Slice Closeout

Each implementation slice must end with:

- files changed
- what changed
- validation run
- remaining follow-up items
- docs: updated / not needed

## Preflight Docs

Read before changing this roadmap or implementing slices:

- `README.md`
- `docs/README.md`
- `docs/datagrid-product-report.ru.md`
- `docs/datagrid-feature-catalog.md`
- `docs/datagrid-vue-stable-entrypoint.md`
- `docs/datagrid-grid-api.md`
- `docs/server-datasource/quick-start.md`
- `docs/server-datasource/README.md`
- `docs/server-datasource/integration-docs-map.md`
- `docs/datagrid-public-api-inventory.md`
- `docs/datagrid-versioned-public-protocol.md`

## Slice Roadmap

| Order | Slice | Goal | Primary files |
| ---: | --- | --- | --- |
| 1 | Root README adoption pass | Make first 3-5 minutes clear: what it is, install, first grid, package choice. | `README.md` |
| 2 | Package choice cleanup | Remove ambiguity around `@affino/datagrid` vs `@affino/datagrid-vue-app` and define package roles. | `docs/datagrid-feature-catalog.md`, maybe new `docs/datagrid-package-map.md` |
| 3 | Docs index reflow | Make `docs/README.md` read like an external navigation map, not an archive. | `docs/README.md` |
| 4 | Stable API starter narrative | Clarify stable vs starter vs advanced/power-user. | `docs/datagrid-vue-stable-entrypoint.md`, `docs/datagrid-grid-api.md` |
| 5 | Server datasource onboarding trim | Make read-only server grid the first path; move optional edit/history/fill lower. | `docs/server-datasource/README.md`, `docs/server-datasource/quick-start.md`, `docs/server-datasource/integration-docs-map.md` |
| 6 | Public API trust summary | Turn protocol/API inventory rigor into external trust signals. | `docs/datagrid-versioned-public-protocol.md`, `docs/datagrid-public-api-inventory.md`, maybe new `docs/datagrid-api-stability.md` |
| 7 | Demo/sandbox entry hierarchy | Add demo-facing sequence without changing grid behavior. | `packages/datagrid-sandbox/src/App.vue`, `packages/datagrid-sandbox/src/router.ts`, maybe docs |
| 8 | OSS contributor trust layer | Add contributor path and validation tiers. | `CONTRIBUTING.md`, maybe `.github/*`, docs index |
| 9 | Spreadsheet/Gantt visibility pass | Make these visible as product capabilities without overclaiming. | `README.md`, `docs/README.md`, relevant feature docs |
| 10 | Adoption docs consolidation | Link saved audits into a coherent roadmap and mark implementation status. | audit docs, `docs/README.md` |

## Slice 1: Root README Adoption Pass

### Change

- Replace monorepo-first opening with product positioning.
- Add a 5-minute Vue quick start using `@affino/datagrid-vue-app`.
- Add a “Choose your package” table.
- Keep benchmarks and maintainer commands, but move them below adoption content.

### Validation

- `pnpm --filter @affino/datagrid-vue-app type-check` only if examples use exported types.
- Manual doc review for package names and links.

### Notes

- Highest adoption impact and lowest technical risk.
- Do not touch runtime, public APIs, package exports, or sandbox code in this slice.

## Slice 2: Package Choice Cleanup

### Change

- Fix or qualify `@affino/datagrid` in `docs/datagrid-feature-catalog.md`.
- Add clear roles for `core`, `vue`, `vue-app`, server adapters, and feature subpaths.
- Prefer new `docs/datagrid-package-map.md` if the table would bloat the catalog.

### Validation

- `rg '@affino/datagrid' README.md docs packages/*/README.md`
- Confirm referenced packages exist under `packages/*/package.json`.

### Notes

- If `@affino/datagrid` is planned, mark it as planned/unpublished rather than recommended.
- If it is not planned, remove it from user-facing package maps.

## Slice 3: Docs Index Reflow

### Change

Reorder `docs/README.md` around external user flow:

1. Start here
2. Quick start / package map
3. Server datasource
4. API stability
5. Feature guides
6. Advanced/platform references
7. Internal/quality

Keep audit links, but move them under a planning/audits group so they do not crowd user entrypoints.

### Validation

- Link/path check with targeted `test -f` or `rg`.
- No code validation needed.

## Slice 4: Stable API Starter Narrative

### Change

- Add “Stable does not mean beginner” note.
- Add starter subset:
  - `DataGrid`
  - `rows`
  - `columns`
  - `v-model:state`
  - `rowSelection`
  - `useDataGridRuntime` only when owning runtime
- Add small tables for mutation APIs and selection terminology.

### Validation

- Docs-only unless examples import types.
- If examples are type-bearing, run relevant package type-check.

## Slice 5: Server Datasource Onboarding Trim

### Change

- Make `POST /api/{tableId}/pull` the clear first milestone.
- Move histogram/history/fill/change-feed below “After first grid renders.”
- Make `createDataSourceBackedRowModel` the preferred path everywhere.
- Keep protocol/consistency docs discoverable but not first-read blockers.

### Validation

- Check all server datasource links.
- Verify quick-start examples still match public package names.

## Slice 6: Public API Trust Summary

### Change

Add a public-facing stability page or summary:

- stable / advanced / internal
- no deep imports
- deprecation windows
- codemods
- API inventory/report checks

Keep detailed protocol docs as reference.

### Validation

- `pnpm run quality:api:datagrid:inventory` only if API docs mention generated inventory paths or exports change.
- For docs-only summary, no API validation needed.

## Slice 7: Demo/Sandbox Entry Hierarchy

### Change

Add grouped nav or `/showcase` route:

- Hero: Workbench, Server Datasource, Spreadsheet, Gantt, Performance
- Showcase: Pivot, Tree, Formula, Custom Cells
- Advanced/Debug: Core API, Worker, Typed Facade, diagnostics/plumbing

Do not remove existing routes.

### Validation

- `pnpm --filter @affino/datagrid-sandbox type-check`
- `pnpm --filter @affino/datagrid-sandbox build`
- Manual browser check if changing navigation/visual flow.

## Slice 8: OSS Contributor Trust Layer

### Change

- Add `CONTRIBUTING.md` with setup, package boundaries, validation tiers, API change rules.
- Optional follow-up: PR template, issue templates, `SECURITY.md`, `CODE_OF_CONDUCT.md`.

### Validation

- Docs-only.
- Link check from README/docs index.

## Slice 9: Spreadsheet/Gantt Visibility Pass

### Change

Add short README/docs callouts:

- spreadsheet-like workflows, not full workbook clone
- Gantt/planning view as app capability

Link to existing docs and demos.

### Validation

- Docs-only.
- Confirm claims match current package docs.

## Slice 10: Adoption Docs Consolidation

### Change

- Add status markers to saved audit docs or create one implementation tracker.
- Keep audits as planning artifacts, not first-user docs.

### Validation

- Docs-only.

## Open Decisions

- Decide whether `@affino/datagrid` is planned or should be removed from user-facing package maps.
- Decide whether new docs should be one `datagrid-package-map.md` plus README links, or embedded directly in README.
- Decide whether sandbox demo hierarchy starts as docs-only first or actual route/nav change later.

## Recommended First Slice

Start with Slice 1: root `README.md`. It has the largest adoption impact and lowest technical risk.
