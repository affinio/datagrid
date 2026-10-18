# Saved table preferences

Use `state-persistence` on `DataGrid` for automatic saving and restoration. Do not add
separate width/filter watchers or restore again from `@ready`.

```vue
<DataGrid :rows="rows" :columns="columns" state-persistence="orders:v1:user-42" />
```

The string form uses localStorage with a 150 ms save debounce. Choose a key that
includes the table, schema version and user/account identity. The host owns that
identity; DataGrid does not infer authentication or clear another user's keys.

## Behavior

- Restore waits for the runtime and nonempty declared columns. During restoration,
  the mounted grid is hidden and inert behind a loading placeholder. `ready` fires
  after restoration settles, including load failure. Inspect `persistence-change`
  to distinguish success from failure.
- Column order, visibility, authored/resized base widths, pinning, sorting, filters,
  grouping, pivoting, aggregation and pagination use the existing unified state.
  A flex column's rendered share of free space is not persisted as its base width.
- Resize updates the screen continuously; storage writes wait until release.
  Other changes use the debounce. Selection-only changes and runtime counters do
  not cause preference writes when those features are excluded.
- Removed column keys are discarded from saved layout; new columns use their
  declared defaults. Field renames and changes to filter semantics require a new
  key/schema version or migration in `load`.
- Controlled inputs win over restored values: `state`, then individual column,
  sorting/filtering, grouping, aggregation and pivot props. Prefer automatic
  persistence without `v-model:state` for ordinary integrations. If supplying
  controlled state, its parent must accept emitted updates for user edits.
- `columnWidths`, `columnPins` and other explicit props remain authoritative.
  Do not supply default widths as controlled props; put defaults in
  `columns[].initialState`.
- Undo/redo history is never persisted. Scroll position, cell/row selection and
  group expansion are excluded by default. Opt in with `includeViewportPosition`,
  `includeSelection` and `includeGroupExpansion` respectively.
- A corrupt/unreadable saved value emits an error and is not overwritten by
  defaults. The table remains usable. Explicit reset recovers storage.

## Async storage

Declare a stable configuration object (or a computed object keyed by user/table).
Provide both `load` and `save`; callbacks receive the captured key, so they should
not read a mutable current-user variable after awaiting a request.

```ts
import type { DataGridStatePersistenceOptions } from '@affino/datagrid-vue-app'

const persistence: DataGridStatePersistenceOptions = {
  key: 'orders:v1:user-42',
  async load({ key }) {
    const response = await fetch(`/api/grid-preferences/${encodeURIComponent(key)}`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Could not load preferences')
    return response.json()
  },
  async save({ key, state }) {
    const response = await fetch(`/api/grid-preferences/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    if (!response.ok) throw new Error('Could not save preferences')
  },
}
```

```vue
<DataGrid
  ref="grid"
  :rows="rows"
  :columns="columns"
  :state-persistence="persistence"
  @persistence-change="status = $event"
/>
<button @click="grid?.resetPersistedState()">Reset preferences</button>
```

`persistence-change` emits `{ key, status, operation?, error? }` where status is
`loading | ready | saving | error` and operation is `load | save` when applicable.
Use it for a save indicator and an actionable error message. After a save failure,
changes remain in the grid and the next preference change attempts another save.
Remount to retry a failed load, or explicitly reset preferences.

`resetPersistedState(): Promise<boolean>` restores the initial configured state
and writes it through the same adapter. It returns whether persistence succeeded.
Reset writes a default snapshot rather than deleting a remote record; adapters do
not need a separate delete API. Controlled props retain priority.

Writes are serialized within the mounted grid, including reset. Changing the key
flushes pending edits to the old key and ignores stale load results/status events.
Async callbacks already in flight are not cancelled. Use server revisions for
cross-tab, cross-device or independently mounted grids writing the same key.
A browser cannot guarantee completion of an async save during page exit; saves
normally happen while the page is open. Local storage flushes synchronously on
pagehide/unmount.

## Migration and boundaries

Previously declarative persistence included viewport position by default and
could store selection/history. To retain scroll restoration, set
`includeViewportPosition: true`; selection and group expansion have separate
explicit flags. History is always excluded.

The persisted envelope is still `DataGridUnifiedState` version 1. Existing local
snapshots remain readable; this does not introduce a second state format. Per-row
height overrides and named-view management are not added by this slice. Existing
`getSavedView`/`applySavedView` helpers remain available for named views.

Sandbox: `/vue/state-persistence` (Saved Preferences). It includes local storage,
a delayed async adapter, independent profiles, reset, an extra column and a
simulated save failure. The async demo uses localStorage behind a delay; it is not
a backend implementation.

Validation: component contracts cover deferred columns, stale loads, controlled
sort plus persisted filters, corrupt values and serialized reset. Browser coverage
checks resize release, quick-filter restoration and visible widths across reload.
