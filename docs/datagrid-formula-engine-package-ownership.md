# Formula engine package ownership

Status: implemented.

`@affino/datagrid-formula-engine` owns formula parsing, diagnostics, analysis,
compiled artifacts, graph planning, value helpers, and reusable function packs
(including the finance pack). Formula packs can be selected by the Vue app's
`formulaPacks` option or combined with application-defined functions.

`@affino/datagrid-vue` owns UI-facing formula runtime configuration and
performance presets. Worker execution uses the ordinary core and worker runtime
contracts.

Async formulas, automatic volatile scheduling, and server-backed formula
evaluation remain unsupported or host-owned; see the formula runtime guide for
current limits. There is no separate enterprise formula package or license gate.
