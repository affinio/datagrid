# DataGrid Public API Inventory

Updated: `2026-05-20`

This document is the current public-surface inventory for DataGrid packages. It classifies package export maps by tier and names the remaining boundary risks before API enterprise hardening changes the public contract.

The generated snapshot lives at `docs/quality/datagrid-public-api-inventory.json` and is checked by:

```bash
pnpm run quality:api:datagrid:inventory
```

## Package Export Tiers

| Package | Export paths | Current tier decision | Remaining risk |
| --- | --- | --- | --- |
| `@affino/datagrid-core` | `.`, `./advanced`, `./internal`, `./*` | Root is stable, `advanced` is power-user, `internal` is unsafe, wildcard is a development-only risk. | `./*` still makes source-shaped deep imports reachable and must be hardened or explicitly isolated before a public API stability claim. |
| `@affino/datagrid-vue` | `.`, `./stable`, `./app`, `./app/worker`, `./advanced/*`, `./worker` | `./stable` is stable; root currently aliases the stable entry; app, worker, and advanced subpaths are advanced integration surfaces. | Stable-entrypoint docs must stay reconciled with the root/stable source exports. |
| `@affino/datagrid-vue-app` | `.`, feature subpaths, `./internal` | Root and feature subpaths are app-facing stable surfaces; `./internal` is unsafe/internal. | Props, exposed Vue ref helpers, services, startup order, and renderer hooks need a public-vs-advanced table. |
| `@affino/datagrid-orchestration` | `.` | Broad root is treated as adapter-internal public-root risk. | The package needs stable/advanced tiering or an explicit adapter-internal positioning statement. |
| `@affino/datagrid-server-adapters` | `.` | Stable backend adapter surface. | Compatibility notes should stay aligned with server datasource protocol changes. |
| `@affino/datagrid-server-client` | `.` | Stable backend client helper surface. | Live update, retry, and consistency-token changes need migration notes when public behavior changes. |

## Snapshot Policy

- Any new package export path must be classified in `scripts/check-datagrid-public-api-inventory.mjs`.
- Any changed source entrypoint or export declaration must refresh `docs/quality/datagrid-public-api-inventory.json` with `node ./scripts/check-datagrid-public-api-inventory.mjs --write-baseline` after review.
- Public API movement between stable, advanced, and internal tiers requires migration notes in `docs/datagrid-migration-guide.md` or the domain-specific guide.
- The generated inventory is an export-map and entrypoint declaration snapshot. It is not a substitute for a future `.d.ts` API report gate.

## Current Hardening Order

1. Resolve or isolate the `@affino/datagrid-core` wildcard export.
2. Reconcile `@affino/datagrid-vue` root/stable exports with `docs/datagrid-vue-stable-entrypoint.md`.
3. Decide orchestration package positioning: adapter-internal package or tiered public surface.
4. Add renderer lifecycle and app expose/service tier docs.
5. Promote the snapshot into a richer API diff report when declaration baselines are available.
