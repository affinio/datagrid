# `@affino/datagrid-pivot`

Community pivot API boundary for Affino DataGrid.

## Purpose

This package freezes the pivot-specific public boundary before first release.

Current state:

- community-safe pivot types and pure helper APIs live here
- low-level row-model orchestration and pivot runtime integration still live in `@affino/datagrid-core`

## Community surface

The package intentionally exposes the base pivot surface:

- pivot model/type contracts
- pivot drilldown contracts
- pivot layout snapshot contracts
- pivot spec normalization / cloning / equality helpers

## Planned enterprise surface

These are reserved as future enterprise candidates and are intentionally not split into public package entrypoints yet:

- premium high-cardinality pivot runtime tiers
- advanced incremental pivot patch strategies
- pivot profiler / diagnostics tooling
- premium pivot UX shells and runtime controls
- server-backed pivot acceleration and scaling layers

## Boundary rule

Use `@affino/datagrid-pivot` for pivot contracts and pure helper APIs.
Keep row-model orchestration and runtime integration inside `@affino/datagrid-core` until the next extraction phase.
