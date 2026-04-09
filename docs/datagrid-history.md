# DataGrid History API

Updated: 2026-04-09

This document describes the public history contract exposed by `@affino/datagrid-vue-app`.

## Public prop

`DataGrid` accepts `history` as either:

- `true` / `false`
- `DataGridHistoryOptions`

```ts
type DataGridHistoryProp = boolean | {
  enabled?: boolean
  depth?: number
  shortcuts?: false | "grid" | "window"
  controls?: false | "toolbar" | "external-only"
  adapter?: DataGridTableStageHistoryAdapter
}
```

## Semantics

- `enabled: false` disables history entirely.
- `depth` limits recorded transactions/intents.
- `depth` does not count every raw cell keystroke as a separate undo step.
- `adapter` lets an application inject its own undo/redo source.
- When `adapter` is omitted, the app facade uses its built-in intent history.

## Shortcuts

- `false`: no built-in keyboard shortcuts
- `"grid"`: shortcuts are active while the grid owns keyboard focus
- `"window"`: shortcuts are bound at `window` scope

## Controls

- `false`: no built-in visual controls
- `"toolbar"`: render built-in `Undo` / `Redo` toolbar buttons
- `"external-only"`: no built-in controls, but keep the controller exposed for external UI

## Exposed controller

The component ref exposes a stable history controller regardless of whether history comes from the built-in implementation or an injected adapter:

```ts
interface DataGridHistoryController {
  canUndo(): boolean
  canRedo(): boolean
  runHistoryAction(direction: "undo" | "redo"): Promise<string | null>
}
```

Access it through:

- `gridRef.value?.history`
- `gridRef.value?.getHistory()`

## Example

```vue
<script setup lang="ts">
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"

const gridRef = ref<{
  getHistory?: () => {
    runHistoryAction?: (direction: "undo" | "redo") => Promise<string | null>
  }
} | null>(null)

async function redo() {
  await gridRef.value?.getHistory()?.runHistoryAction("redo")
}
</script>

<template>
  <button type="button" @click="redo">
    Redo
  </button>

  <DataGrid
    ref="gridRef"
    :rows="rows"
    :columns="columns"
    :history="{ depth: 100, shortcuts: 'grid', controls: 'external-only' }"
  />
</template>
```