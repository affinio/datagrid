# Internal Documentation

This folder contains planning and maintenance material. It is useful for maintainers, but it is not the primary package integration path.

Last reviewed: `2026-10-21`.

The 2026-05 enterprise audits and plans are historical records. The former package split was retired and its usable features now ship through the ordinary Vue and formula-engine packages.

## Sections

- [audits](./audits/) - codebase audits and investigation notes.
- [checklists](./checklists/) - internal completion and acceptance checklists.
- [pipelines](./pipelines/) - delivery/refactor pipeline documents.
- [plans](./plans/) - implementation plans and roadmap slices.
- [todos](./todos/) - narrow follow-up trackers.

## Current Open Items

| Priority | Open item | Current state | File |
| --- | --- | --- | --- |
| P0 | Core public contracts for consistent reads, data coverage, operation outcomes, and selection scope need hardening. | Audit findings are tracked slice by slice; transaction batch completion/failure semantics are the first active slice. | [datagrid-core-contract-hardening-plan.md](./plans/datagrid-core-contract-hardening-plan.md) |
| P0 | Server datasource gaps: offline mutation replay, general hierarchical projection, and some unloaded-row operations. | Polling and WebSocket transports, retry/backoff, cache invalidation, placeholders, edit/fill/history, and delegated copy/paste/fill/range-move paths exist. The demo backend supports only single-level `region` grouping; offline replay, arbitrary tree/pivot projection, SSE, server summaries, and series fill remain unsupported or host-owned. | [server-data-source-checklist.md](./checklists/server-data-source-checklist.md) |
| P1 | Spreadsheet structural formula model is still not fully token/reference-owned. | Sheet/workbook runtime has compiled references and sheet-qualified refs, but row/column structural rewrites still render updated `rawInput` eagerly in several paths. | [datagrid-spreadsheet-token-reference-transition-todo.md](./todos/datagrid-spreadsheet-token-reference-transition-todo.md) |
| P1 | Pivot/tree performance maturity is partially closed, not done. | Pivot/tree assert benches and CI gates exist; deeper tree data-structure optimization, broader pivot patch tiers, and memory-budget discipline remain. | [datagrid-pivot-tree-performance-plan.md](./plans/datagrid-pivot-tree-performance-plan.md) |
| P1 | Modular kernel host contracts remain future architecture work. | Formula, pivot, diagnostics, tree, and server packages/boundaries exist in pieces; host-registration contracts are still not the core ownership model. | [datagrid-v2-modular-kernel-plan.md](./plans/datagrid-v2-modular-kernel-plan.md) |
| P1 | Server-side row model lacks hierarchical stores/block cache policy. | `createDataSourceBackedRowModel` is production-shaped for flat pulls and invalidation; SSRM v2-style hierarchical stores remain future scaling work. | [datagrid-ag-architecture-acceptance-checklist.md](./checklists/datagrid-ag-architecture-acceptance-checklist.md) |
| P2 | Broader selection facade documentation and high-level DOM/render decoupling remain incomplete. | The row-ID model, projection range rules, row-header gestures, and app integration now have a public [row-selection reference](../../packages/datagrid-core/docs/reference/modules/selection/row-selection.md); cell-selection facade guarantees and framework-neutral render materialization remain follow-up work. | [datagrid-architecture-debt-checklist.md](./checklists/datagrid-architecture-debt-checklist.md) |
| P2 | Pull/server row-model parity cleanup remains. | Shared serialization helpers exist; snapshot builder, group expansion/pagination mutators, and viewport cache invalidation helpers are not fully unified. | [datagrid-refactor-perfectionist-pipeline.md](./pipelines/datagrid-refactor-perfectionist-pipeline.md) |
| P2 | Worker-owned row model still has real-worker expansion work. | Worker-owned protocol, frame/pressure benches, and parity checks exist; non-viewport query endpoints and heavier pure-stage migration remain. | [datagrid-worker-compute-pipeline.md](./pipelines/datagrid-worker-compute-pipeline.md) |
| P3 | AI/action architecture is still roadmap-only. | No `@affino/action-core`, `@affino/agent-core`, or dashboard command package exists in the current package set. | [AI_INTEGRATION_ROADMAP.md](./pipelines/AI_INTEGRATION_ROADMAP.md) |

For user-facing integration docs, start with:

- [Server datasource](../server-datasource/README.md)
- [Server datasource UX contract](../server-datasource/ux-contract.md)
- [Server datasource integration map](./reference/server-datasource-integration-map.md)
- [Formula runtime reference](./reference/datagrid-formula-engine-runtime-reference.md)

## Reference material

- [Maintainer command cheatsheet](./reference/scripts-cheatsheet.ru-en.md)
- [Product report](./reference/datagrid-product-report.ru.md)
- [Codex reference map](./reference/codex-reference-map.md)
- [Legacy migration reference](./reference/datagrid-legacy-migration-guide.md)
- [Sheets interaction baseline](./reference/datagrid-sheets-user-interactions-and-integrator-api.md)
- [Server datasource integration map](./reference/server-datasource-integration-map.md)
- [API starter and export inventory](./reference/datagrid-api-start-here.md)
- [Public API inventory](./reference/datagrid-public-api-inventory.md)
- [Versioned public protocol](./reference/datagrid-versioned-public-protocol.md)
- [Public documentation template](./reference/public-documentation-template.md)

Audits and research are kept under `audits/`; product-facing documentation must not depend on them.

## Architecture reference

- [Architecture decomposition](./architecture/datagrid-component-decomposition.md)
- [Core purity and dependency model](./architecture/datagrid-core-purity-policy.md)
- [Viewport architecture](./architecture/datagrid-viewport-controller-decomposition.md)
- [Viewport math](./architecture/datagrid-viewport-math-engine.md)
- [Strict contract testing](./architecture/datagrid-strict-contract-testing.md)

(./reference/datagrid-model-contracts.md)
- [Adapter protocol](./reference/datagrid-cross-platform-adapter-protocol.md)
- [Event contract tiers](./reference/datagrid-event-contract-tiers.md)
- [Orchestration boundary](./reference/datagrid-orchestration-public-contract.md)
- [Server datasource Codex prompt](./reference/server-codex-integration-prompt.md)
