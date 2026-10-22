# Pivot package ownership

Status: implemented.

`@affino/datagrid-pivot` owns framework-independent pivot contracts and helpers,
including pivot specs, layout snapshots, normalization, cloning, equality, and
drilldown contracts. The DataGrid core and Vue app own runtime projection and
rendering integration.

There is no separate enterprise pivot package. Server-backed hierarchical
pivoting and large-scale server aggregation remain host/backend responsibilities
until their datasource contracts are implemented.
