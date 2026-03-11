# `@affino/datagrid-formula-engine-enterprise`

Enterprise formula runtime extensions for Affino DataGrid.

## Role

This package is the additive commercial layer on top of
[`@affino/datagrid-formula-engine`](../datagrid-formula-engine/README.md).

Community package keeps the base formula engine:

- parse / diagnose / explain
- compile APIs
- graph / execution-plan APIs
- formula value utilities

Enterprise package is reserved for higher-cost runtime layers:

- worker-owned formula execution
- premium formula packs
- premium vector / fused runtime tiers
- profiler / explain tooling
- enterprise compute policies
- premium collaboration / audit extensions around formula execution

## Boundary

`@affino/datagrid-formula-engine-enterprise` may depend on
`@affino/datagrid-formula-engine`.

The reverse must never happen.
