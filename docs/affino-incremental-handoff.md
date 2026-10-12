# Affino DataGrid incremental update handoff

This handoff covers the DataGrid packages in this repository. TreeView changes
belong to its separate source repository.

## Packages and local installation

The release candidates are `@affino/datagrid-core` 0.9.0,
`@affino/datagrid-orchestration` 0.7.0, `@affino/datagrid-worker` 0.7.0,
`@affino/datagrid-gantt` 0.2.0, `@affino/datagrid-vue` 0.9.0, and
`@affino/datagrid-vue-app` 0.12.0. They have not been published to npm. After
building, the local tarballs are:

- `artifacts/incremental/affino-datagrid-core-0.9.0.tgz`
- `artifacts/incremental/affino-datagrid-orchestration-0.7.0.tgz`
- `artifacts/incremental/affino-datagrid-worker-0.7.0.tgz`
- `artifacts/incremental/affino-datagrid-gantt-0.2.0.tgz`
- `artifacts/incremental/affino-datagrid-vue-0.9.0.tgz`
- `artifacts/incremental/affino-datagrid-vue-app-0.12.0.tgz`

Install the six local packages together in the consumer with pnpm. This keeps
the Vue app's direct and optional-peer dependency tree on the same core release
without overrides:

```sh
pnpm add /path/to/affino-datagrid-core-0.9.0.tgz \
  /path/to/affino-datagrid-orchestration-0.7.0.tgz \
  /path/to/affino-datagrid-worker-0.7.0.tgz \
  /path/to/affino-datagrid-gantt-0.2.0.tgz \
  /path/to/affino-datagrid-vue-0.9.0.tgz \
  /path/to/affino-datagrid-vue-app-0.12.0.tgz
```

Source commit: `08281293` (`feat(datagrid): publish exact row edit deltas`).
Publish these versions only after the release owner authorizes the npm release.

## Public contracts

The core root exports `DataGridApiRowsEditedEvent<TRow>` and the Vue root
re-exports it. The app root exports `DataGridRowsEditedEvent<TRow>` and adds the
`data-change` component event.

```ts
interface DataGridApiRowsEditedEvent<TRow = unknown> {
  source: "grid" | "application"
  edits: readonly {
    rowId: DataGridRowId
    oldData: TRow
    newData: TRow
    patch: Partial<TRow>
  }[]
}

interface DataGridApplyEditsOptions {
  emit?: boolean
  reapply?: boolean
  signal?: AbortSignal | null
  source?: "grid" | "application"
}

api.events.on("rows:edited", (event: DataGridApiRowsEditedEvent<Row>) => void): () => void
api.rows.applyEdits(
  updates: readonly DataGridClientRowPatch<Row>[],
  options?: DataGridApplyEditsOptions,
): void | Promise<void>
```

The app event is typed with the same shape and is available as
`<DataGrid @data-change="onDataChange" />`.

```ts
function onDataChange(event: DataGridRowsEditedEvent<Row>) {
  if (event.source !== "grid") return
  for (const edit of event.edits) {
    domainRows.applyPatch(edit.rowId, edit.patch)
  }
}
```

Apply the resulting domain updates to the controlled `rows` prop if the
application owns it. Such prop synchronization does not emit `data-change`;
`cell-change` remains available for the existing row-model snapshot stream.
Calls through `getApi().rows.applyEdits()` default to `source: "application"`.
The host should ignore those events when feeding grid changes back into its
domain update handler.

ID-based structural and value deltas use the existing API:

```ts
const api = gridRef.value?.getApi()
api?.rows.insertDataAfter("r1", [{ row: { id: "r2", amount: 4 }, rowId: "r2" }])
api?.rows.removeData(["r3"])
api?.rows.applyEdits([{ rowId: "r1", data: { amount: 5 } }], { source: "application" })
```

These calls use the current row model and component. `insertDataAt` preserves
the requested position; before/after insertion is anchored by stable ID.
`removeData` removes only the given source rows. Structural changes are not
reported as `rows:edited` value deltas and are not automatically added to the
app's edit history.

## Semantics and limits

- `rows:edited` is emitted after `applyEdits` succeeds and reads the committed
  row values by source ID, including filtered rows. Each event has one entry per
  changed row and only fields whose values changed. Empty patches and no-op
  values emit nothing. `emit: false` suppresses this event.
- Inline edits, checkbox cell edits, paste and paste special, fill, clear,
  range move, find/replace, Gantt edits, and local edit-history replay use
  `applyEdits` with `source: "grid"`. A single call produces one delta packet;
  multiple calls inside `rows.batchMutations()` are coalesced into one packet.
- `cell-change` remains the backwards-compatible row-model snapshot event;
  `cell-edit` remains the backwards-compatible single inline-cell event.
- Editing does not require a visible or projected row. If a projection hides a
  row, its edit still appears in the delta. Sort/filter/group reapply policy
  remains controlled by the existing `reapply` option and auto-reapply setting.
- Local undo/redo replay of edit snapshots emits the inverse/forward value delta
  with `source: "grid"`. Structural insertion/removal and external `rows`
  replacement are not edit transactions. Replacing the dataset does not
  automatically clear application-owned history; discard stale host history
  when dataset identity changes.
- `rowsUpdateMode="patch"` scans both arrays and checks values. It can patch
  same-length arrays with IDs in the same order. A length or ID-order change
  follows the existing `setRows()` replacement path. Use explicit row API
  deltas when the host already knows changed IDs.
- The model benchmark counts public `setRows`/`replaceRows` calls made through a
  proxy around the row model. It does not instrument private projection internals.
  Browser render latency was not measured: no Chromium executable is available
  in this environment.

## Validation and benchmark

Passed package type checks for core, Vue, and Vue app; core and Vue app builds;
the focused core exact-delta contract; and the mounted Vue app inline-edit
contract, including old `cell-edit` behavior and new `data-change` delivery.

Reproduce model timings after building core:

```sh
pnpm --filter @affino/datagrid-core build
node scripts/bench-datagrid-incremental-row-mutations.mjs
```

Environment: Node v24.21.0, Linux arm64, 10 reported CPU threads; 4 warmups and
25 samples per scenario. Setup model construction is excluded from operation
latency. Median/p95 milliseconds:

| Rows | Operation | Median | p95 | Public full resets/op | Row notifications/op |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1k | Edit one | 0.024 | 0.079 | 0 | 1 |
| 1k | Insert one | 0.177 | 0.244 | 0 | 1 |
| 1k | Delete one | 0.145 | 0.167 | 0 | 1 |
| 1k | Patch batch 100 | 0.106 | 0.161 | 0 | 1 |
| 10k | Edit one | 0.034 | 0.122 | 0 | 1 |
| 10k | Insert one | 1.803 | 2.174 | 0 | 1 |
| 10k | Delete one | 2.065 | 2.506 | 0 | 1 |
| 10k | Patch batch 100 | 0.134 | 0.182 | 0 | 1 |
| 50k | Edit one | 0.118 | 0.143 | 0 | 1 |
| 50k | Insert one | 9.823 | 12.581 | 0 | 1 |
| 50k | Delete one | 10.958 | 16.801 | 0 | 1 |
| 50k | Patch batch 100 | 0.221 | 0.358 | 0 | 1 |

These figures measure row-model calls only on this host; they do not predict
browser rendering or application callback cost. Insert/delete time grows with
row count in this implementation. No latency guarantee is implied.
