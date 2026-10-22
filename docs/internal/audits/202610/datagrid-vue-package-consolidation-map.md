# Vue package consolidation: export and consumer map

Status: implemented and superseded by [`docs/vue-package-migration.md`](../../../vue-package-migration.md) and the [Vue app package ownership record](../../../datagrid-vue-app-package-ownership.md).
The package graph, consumer imports, and tarball checks below describe the
pre-migration audit snapshot; use the migration guide and package manifests for
the current state. `@affino/datagrid-vue-app` was removed from the workspace,
and its app implementation now ships from `@affino/datagrid-vue`. The former
Vue app, diagnostics, and formula-engine enterprise packages have also been
removed after moving supported functionality into the standard package owners.
Scope: merge `@affino/datagrid-vue` and `@affino/datagrid-vue-app` while keeping
`@affino/datagrid-core` and `@affino/datagrid-orchestration` independently
published. Laravel compatibility remains in scope. Orchestration's publication
decision is deferred to a separate decision after export classification.

## Current package graph

The published dependency direction is acyclic today:

```text
datagrid-vue-app ──> datagrid-vue ──> datagrid-orchestration ──> datagrid-core
       │                    │
       ├──> datagrid-chrome │
       ├──> datagrid-theme  ├──> datagrid-worker
       └──> menu/popover   └──> datagrid-pivot
```

`datagrid-vue-app` also has a peer on `datagrid-gantt`; `datagrid-vue` has Vue
and Pinia peers and a theme peer. A merged package must declare the union of the
runtime dependencies/peers required by each entrypoint. Optional Gantt and
optional UI subpaths must remain lazy.

There is no current reverse dependency from `datagrid-vue` to `datagrid-vue-app`.
After source co-location, that invariant only holds if app implementation files
stop importing the package name `@affino/datagrid-vue` for their own headless
dependencies. Such imports would resolve through the new root back to the app
root and can create a module cycle. Rewrite them to internal relative modules or
the package's explicit headless implementation barrel.

## Entrypoint migration map

The proposed package name remains `@affino/datagrid-vue`. Its root becomes the
ready-to-use app entry. `/headless` becomes the explicit low-level Vue adapter
entry. During the transition the old `@affino/datagrid-vue-app` package is a
one-way compatibility wrapper over the merged package.

| Current package entry | Current contract | Target entry | Compatibility decision |
| --- | --- | --- | --- |
| `@affino/datagrid-vue` | Documented stable adapter root; common adapter/runtime APIs | `@affino/datagrid-vue/headless` | Keep every existing named root export at the merged root for transition compatibility, and re-export the same headless surface from `/headless`. Document `/headless` as the supported import for custom renderers and bundle isolation. The merged root adds `DataGrid`; audit finds no current `DataGrid` name collision. |
| `@affino/datagrid-vue/stable` | Documented stable alias equivalent to the old root | `@affino/datagrid-vue/headless` | Keep `/stable` as a forwarding alias during the compatibility window; do not create a second implementation module. |
| `@affino/datagrid-vue/app` | Documented advanced app-controller/runtime hooks; used by app, enterprise, spreadsheet, and sandbox code | `@affino/datagrid-vue/headless/app` | Keep the old path as a forwarding alias while consumers migrate. This surface is headless integration, not mounted UI. |
| `@affino/datagrid-vue/app/worker` | Worker-owned app runtime entry; used by sandbox | `@affino/datagrid-vue/headless/app/worker` | Keep a forwarding alias through the compatibility window. |
| `@affino/datagrid-vue/worker` | Worker protocol/runtime support entry; documented in the adapter guide | `@affino/datagrid-vue/headless/worker` | Keep a forwarding alias; verify it does not import app UI. |
| `@affino/datagrid-vue/advanced` | Documented advanced aggregate API | `@affino/datagrid-vue/headless/advanced` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/layout` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/layout` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/pointer` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/pointer` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/selection` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/selection` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/editing` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/editing` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/clipboard` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/clipboard` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/filtering` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/filtering` | Keep the old path as an alias. |
| `@affino/datagrid-vue/advanced/history` | Documented advanced domain API | `@affino/datagrid-vue/headless/advanced/history` | Keep the old path as an alias. |
| `@affino/datagrid-vue-app` | Documented stable app root | `@affino/datagrid-vue` | Keep the old package as a thin wrapper. Its root must re-export from the merged root, not contain a second component/runtime build. |
| `@affino/datagrid-vue-app/gantt` | Documented optional Gantt app entry | `@affino/datagrid-vue/gantt` | Keep the same path under the merged package and re-export it from the wrapper package. Preserve the opt-in chunk boundary. |
| `@affino/datagrid-vue-app/aggregations` | Documented optional UI entry | `@affino/datagrid-vue/aggregations` | Preserve as an optional subpath and wrapper alias. |
| `@affino/datagrid-vue-app/advanced-filter` | Documented optional UI entry | `@affino/datagrid-vue/advanced-filter` | Preserve as an optional subpath and wrapper alias. |
| `@affino/datagrid-vue-app/quick-filter` | Documented optional UI entry | `@affino/datagrid-vue/quick-filter` | Preserve as an optional subpath and wrapper alias. |
| `@affino/datagrid-vue-app/find-replace` | Documented optional UI entry | `@affino/datagrid-vue/find-replace` | Preserve as an optional subpath and wrapper alias. |
| `@affino/datagrid-vue-app/internal` | Explicitly tiered Internal entry, not a supported consumer contract | No permanent public target | Keep only a transition bridge for in-repository users. Move Enterprise, Spreadsheet, and Sandbox off it or give them narrowly scoped package-private build inputs; then remove the bridge in the announced breaking release. Do not mirror this barrel under `/headless`. |

The merged root can expose the app root and old headless named exports together:
TypeScript declaration checking against the current built roots found 509 merged
exports and no duplicate/ambiguous named export diagnostics; `DataGrid` appears
once. This is a declaration-level check, not proof that the future bundler graph
is isolated. Root exports should be explicit rather than broad `export *` chains
where that would pull optional Gantt/UI modules into ordinary table builds.

## Consumers found

| Consumer | Current direct imports | Migration requirement |
| --- | --- | --- |
| `datagrid-vue-app` implementation | Vue root, `/app`, `/advanced`, and types | Co-locate the implementation. Rewrite package-name self-imports to internal headless paths; retain separate app/headless source ownership. |
| `datagrid-vue-app-enterprise` | App root, `/gantt`, `/internal`; Vue root and `/app` | Move supported imports to merged root, `/gantt`, and `/headless/app`. Remove `/internal` usage or keep only a temporary bridge until a private integration seam is agreed. |
| `datagrid-spreadsheet-vue-app` | Vue `/advanced`, `/app`; app root and `/internal` | Move to `/headless/advanced`, `/headless/app`, and merged root; remove internal imports. |
| `datagrid-sandbox` | Both roots, Vue `/app`, `/app/worker`; app `/internal` | Update aliases and examples; remove internal imports before the bridge is retired. |
| `datagrid-showcase` | Both roots | Migrate app types/component to merged root; use `/headless` where adapter APIs are intentionally demonstrated. |
| `datagrid-diagnostics-enterprise` | App package dependency (manifest) | Point dependency at merged package or its designated diagnostics entry. Confirm exact source subpath usage in its build. |
| External app users | Stable app root and documented optional app subpaths; stable/advanced Vue entries | Wrapper preserves the old app package during transition. Document new root and `/headless` paths and a migration window. |

The Sandbox currently has TypeScript path aliases directly to Vue source/dist
files. Update those aliases with package exports; do not let alias resolution
hide a missing export or a package self-reference cycle.

## Names, cycles, and runtime identity

- Current adapter root has no exported `DataGrid` symbol, so the app component
  name does not collide. The current declaration barrels also have no ambiguous
  names when combined. Keep `DataGridWithGantt` at `/gantt`; do not re-export its
  `DataGrid` alias from the ordinary root.
- The combined package must have one copy of the implementation modules. Old
  adapter subpaths, new `/headless` paths, and the temporary app wrapper must
  forward to that copy rather than compile or bundle their own copies.
- The wrapper should only re-export from `@affino/datagrid-vue`. Where package
  manager resolution can install two merged-package versions, pin the wrapper's
  peer/dependency contract so supported mixed imports resolve the same version.
- Test strict identity for `DataGrid` imported from the merged root and old app
  wrapper; test that old adapter-root named functions are strictly identical to
  their `/headless` exports. Also compare exported injection/context keys used
  by the app and verify one provide/inject round trip across mixed imports.
- The intended package dependency graph is `vue-app-compat -> datagrid-vue`
  only. Enterprise may depend on both during transition, but the merged package
  must never depend on the compatibility wrapper. Recheck package manifests and
  source imports for cycles after co-location.

## Tarball consumer checks

Run these against packed artifacts installed into clean projects, not workspace
aliases:

1. **Ready Vue table:** install merged tarball and Vue; import `DataGrid` from
   `@affino/datagrid-vue`, mount it, and verify the default renderer, theme
   tokens, editing, and ordinary table behavior. Inspect output to ensure Gantt
   and optional popovers remain split out.
2. **Custom renderer:** import `useDataGridRuntime` and required adapter types
   from `@affino/datagrid-vue/headless`; mount a consumer-owned renderer and
   exercise selection/runtime lifecycle without importing app components.
3. **Mixed old/new imports:** install the merged tarball and compatibility
   wrapper built against that exact version; import `DataGrid` through both
   paths and assert strict object identity. Check adapter function identity and
   cross-path context provide/inject as described above.
4. **Core without Vue:** install only `@affino/datagrid-core`; compile and run a
   row-model/API consumer. Assert Vue, Pinia, theme, and app packages are absent
   from its dependency tree and its emitted bundle.
5. **Laravel adapter:** install packed `datagrid-laravel` and its declared
   dependencies; type-check and run a smoke consumer for the re-exported core,
   pivot, and orchestration APIs. This guards the existing Laravel contract.
6. **Headless dependency isolation:** build a minimal consumer importing only
   `/headless` and inspect the bundler module graph/metafile. Fail if it reaches
   app stage/renderer modules, CSS, Gantt, `datagrid-chrome`, menu, or popover
   packages. Check both bundled dependency graph and emitted CSS, not tarball
   contents alone.

Use production-mode ESM builds and at least one supported bundler. A small
consumer type-check alone cannot prove CSS or tree-shaking isolation.

## Orchestration decision

The export classification and separate package decision are recorded in
[`datagrid-orchestration-publication-decision.md`](./datagrid-orchestration-publication-decision.md).
The decision for this migration is to retain the standalone orchestration
package and leave the Laravel facade unchanged. It is not a criterion for
success that the repository reduce to two published packages.

## Readiness and remaining work

The two-package Vue product is feasible without changing Core or Orchestration
publication. The root-name collision check is clear and the current package DAG
has a one-way app-to-adapter edge. The significant work is source co-location,
build/declaration output, conditional exports, self-import rewrites, optional
chunk preservation, and tarball verification.

This audit does not implement the merge. Before coding, agree on the legacy
adapter root rule (retain its named exports at the new root for compatibility;
direct headless consumers should migrate to `/headless`) and the deprecation
window for `datagrid-vue-app` and its Internal subpath. The consumer checks above
are release gates for the migration slice.
