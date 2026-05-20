# Internal Documentation

This folder contains planning and maintenance material. It is useful for maintainers, but it is not the primary package integration path.

Last stale-doc sweep: `2026-05-20`.

Scope of this sweep excludes `docs/internal/audits/202605/` and `docs/internal/plans/202605/`; those enterprise audit/plan folders are treated as their own current status track.

## Sections

- [audits](./audits/) - codebase audits and investigation notes.
- [checklists](./checklists/) - internal completion and acceptance checklists.
- [pipelines](./pipelines/) - delivery/refactor pipeline documents.
- [plans](./plans/) - implementation plans and roadmap slices.
- [todos](./todos/) - narrow follow-up trackers.

## Current Open Items

| Priority | Open item | Current state | File |
| --- | --- | --- | --- |
| P0 | Server datasource enterprise gaps: websocket/SSE transport, offline mutation replay, tree/pivot projection, broader grouping, and unloaded-row operation handlers. | Polling change feed, retry/backoff, cache invalidation, placeholders, fill/edit/history, server-client extraction, and `server_demo` single-level `region` grouping are implemented; enterprise projection/live/offline work remains. | [server-data-source-checklist.md](./checklists/server-data-source-checklist.md) |
| P0 | Open-core monetization boundary is not release-complete. | Enterprise app, diagnostics, formula-engine enterprise, commercial checks, and license UX exist; `datagrid-worker-enterprise`, `datagrid-pivot-enterprise`, publish policy, and independent enterprise release flow remain open. | [datagrid-open-core-monetization-pipeline.md](./pipelines/datagrid-open-core-monetization-pipeline.md) |
| P1 | Spreadsheet structural formula model is still not fully token/reference-owned. | Sheet/workbook runtime has compiled references and sheet-qualified refs, but row/column structural rewrites still render updated `rawInput` eagerly in several paths. | [datagrid-spreadsheet-token-reference-transition-todo.md](./todos/datagrid-spreadsheet-token-reference-transition-todo.md) |
| P1 | Pivot/tree performance maturity is partially closed, not done. | Pivot/tree assert benches and CI gates exist; deeper tree data-structure optimization, broader pivot patch tiers, and memory-budget discipline remain. | [datagrid-pivot-tree-performance-plan.md](./plans/datagrid-pivot-tree-performance-plan.md) |
| P1 | Modular kernel host contracts remain future architecture work. | Formula, pivot, diagnostics, tree, and server packages/boundaries exist in pieces; host-registration contracts are still not the core ownership model. | [datagrid-v2-modular-kernel-plan.md](./plans/datagrid-v2-modular-kernel-plan.md) |
| P1 | Server-side row model lacks hierarchical stores/block cache policy. | `createDataSourceBackedRowModel` is production-shaped for flat pulls and invalidation; SSRM v2-style hierarchical stores remain an enterprise candidate. | [datagrid-ag-architecture-acceptance-checklist.md](./checklists/datagrid-ag-architecture-acceptance-checklist.md) |
| P2 | Column groups and row pinning still need first-class runtime/API semantics. | Pivot grouped headers and pinned bottom shell behavior exist, but general column-group runtime and top/bottom row pinning are still not complete public contracts. | [datagrid-ag-architecture-acceptance-checklist.md](./checklists/datagrid-ag-architecture-acceptance-checklist.md) |
| P2 | Selection facade documentation and high-level DOM/render decoupling remain incomplete. | Legacy selection surface is gone and orchestration tests exist; facade input/output guarantees still need a current contract doc. | [datagrid-architecture-debt-checklist.md](./checklists/datagrid-architecture-debt-checklist.md) |
| P2 | Pull/server row-model parity cleanup remains. | Shared serialization helpers exist; snapshot builder, group expansion/pagination mutators, and viewport cache invalidation helpers are not fully unified. | [datagrid-refactor-perfectionist-pipeline.md](./pipelines/datagrid-refactor-perfectionist-pipeline.md) |
| P2 | Worker-owned row model still has real-worker expansion work. | Worker-owned protocol, frame/pressure benches, and parity checks exist; non-viewport query endpoints and heavier pure-stage migration remain. | [datagrid-worker-compute-pipeline.md](./pipelines/datagrid-worker-compute-pipeline.md) |
| P3 | AI/action architecture is still roadmap-only. | No `@affino/action-core`, `@affino/agent-core`, or dashboard command package exists in the current package set. | [AI_INTEGRATION_ROADMAP.md](./pipelines/AI_INTEGRATION_ROADMAP.md) |

For user-facing integration docs, start with:

- [Server datasource](../server-datasource/README.md)
- [Server datasource UX contract](../server-datasource/ux-contract.md)
- [Server datasource integration map](../server-datasource/integration-docs-map.md)
