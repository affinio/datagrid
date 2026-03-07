# `@affino/datagrid-formula-engine`

Community formula engine package for Affino DataGrid.

## Purpose

This package establishes a dedicated formula-engine boundary without forcing a risky implementation move out of `@affino/datagrid-core` in one step.

Current state:

- community-safe formula parsing / analysis / compile APIs live here
- graph / execution-plan APIs live here
- low-level row-model integration still lives in `@affino/datagrid-core`

## Community surface

The package intentionally exposes the base formula-engine surface:

- parse / diagnose / explain
- compile formula field definitions and artifacts
- formula value utilities
- formula graph and execution-plan builders
- formula-related type contracts

## Planned enterprise surface

These are reserved as future enterprise candidates and are intentionally not split into public package entrypoints yet:

- premium worker-owned formula runtime
- advanced fused / vector execution tiers
- formula profiler / diagnostics UI
- collaboration / snapshot / audit tooling around formula execution
- premium performance policies and high-scale runtime orchestration

## Boundary rule

Use `@affino/datagrid-formula-engine` for formula APIs.
Keep grid row-model orchestration and snapshot integration in `@affino/datagrid-core` until the next extraction phase.
