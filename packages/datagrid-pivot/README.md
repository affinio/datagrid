# `@affino/datagrid-pivot`

Pivot API boundary for Affino DataGrid.

## Purpose

This package freezes the pivot-specific public boundary before first release.

Current state:

- public pivot types and pure helper APIs live here
- low-level row-model orchestration and pivot runtime integration still live in `@affino/datagrid-core`

## Public surface

The package exposes:

- pivot model/type contracts
- pivot drilldown contracts
- pivot layout snapshot contracts
- pivot spec normalization / cloning / equality helpers

## Boundary rule

Use `@affino/datagrid-pivot` for pivot contracts and pure helper APIs.
Keep row-model orchestration and runtime integration inside `@affino/datagrid-core` until the next extraction phase.
