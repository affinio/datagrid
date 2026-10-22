# DataGrid orchestration publication decision

Status: current decision for the Vue package consolidation; retain the
independently published package. Revisit only in a separate migration with a
Laravel replacement contract.

## Scope

`@affino/datagrid-orchestration` is a Core-dependent, framework-light runtime
package. It is not part of the first `datagrid-vue` + `datagrid-vue-app`
consolidation. This decision classifies its 18 root export domains and checks
whether current consumers can use it independently.

## Export classification

| Domain barrel | Export shape | Classification | Consumer evidence |
| --- | --- | --- | --- |
| `accessibility` | Cell-id helper and options/results | Adapter utility | Vue adapter implementation |
| `scrolling` | Wheel/touch policy, linked-pane sync, idle gate, telemetry lifecycles | Framework-light interaction utilities | Laravel re-exports wheel-scroll API; Vue adapter and app use the domain |
| `navigation` | Cell navigation, keyboard routing, tab-target resolution | Adapter interaction utilities | Vue adapter |
| `cells` | Coordinate normalization, dataset/range helpers, visibility and visual predicates | Renderer/adapter utilities | Vue adapter |
| `pointer` | Pointer routing, preview, selection, auto-scroll, modifier policy | Framework-light gesture lifecycle primitives | Vue adapter and app |
| `clipboard` | Clipboard range/value policy and mutation helpers | Adapter workflow utilities | Vue adapter and app |
| `columns` | Pure column metrics/layers plus filter and UI orchestration | Mixed: reusable layout functions and adapter workflow hooks | Laravel re-exports column layout functions/hooks; Vue adapter and app |
| `contextMenu` | State, keyboard intent, action/anchor/viewport routing | Adapter workflow utilities | Vue adapter and app |
| `fill` | Pure fill behavior/matrix helpers plus fill gesture lifecycles | Mixed: reusable functions and adapter workflow hooks | Vue adapter and app |
| `grouping` | Group normalization, labels, badge and sort summaries | Adapter/model presentation utilities | Vue adapter and app |
| `headers` | Header geometry, action/sort/resize interaction hooks | Adapter workflow utilities | Vue adapter and app |
| `editing` | Editable-value policy, enum/editor state, focus and key routing | Adapter workflow utilities | Vue adapter and app |
| `history` | History action and intent lifecycle hooks | Adapter workflow utilities | Vue adapter and app |
| `selection` | Row-selection state transitions, cell selection gesture/range lifecycles, overlay geometry | Mixed: framework-independent selection functions and adapter gesture workflows | Vue adapter and app; Core owns canonical selection models |
| `rows` | Quick-filter normalization, row sorting, projection and action hooks | Mixed: pure helpers and adapter workflow | Vue adapter |
| `viewport` | Range math, measurement scheduling, scroll lifecycle and recovery | Mixed: pure range computation and adapter lifecycle utilities | Vue adapter and app; Core owns canonical viewport math |
| `runtime` | Runtime service composition and refresh lifecycle; Core viewport types | Runtime integration surface | Laravel re-exports `createDataGridRuntime`; Vue adapter |
| `contracts` | Context-menu and pointer-coordinate types | Shared contracts | Vue adapter and app |

The root is not a single-purpose collection of pure functions: many exports
named `use*` manage stateful interaction lifecycles, while several barrels mix
those hooks with pure resolvers. The package has no Vue dependency in its
manifest and depends only on Core; consumers provide host-specific state and
callbacks. Keep that framework-light property as part of the package contract.

## Consumers and decision

- `datagrid-vue` and `datagrid-vue-app` consume orchestration internally as
  adapter infrastructure.
- The private Sandbox imports orchestration directly for integration examples;
  it is not evidence by itself for a public package.
- `datagrid-laravel` re-exports selected runtime values, helpers, and types from
  orchestration through its public package entry. This is a real published
  compatibility dependency, not only an internal workspace edge.

**Decision:** retain `@affino/datagrid-orchestration` as independently
published for now, and leave the Laravel facade and its exports unchanged
during Vue package consolidation. Do not mark the package private or bundle it
into the new Vue package.

This is not a final claim that every root export needs a separate npm package.
Before reconsidering publication, add contract tests for the exact Laravel
re-exports, identify which of the mixed utility/lifecycle exports Laravel
consumers actually need, and decide whether Laravel should keep the dependency,
vendor a stable subset, or depend on a differently scoped framework-light
package. Recheck package manifests and type/runtime output from tarballs before
changing that decision.
