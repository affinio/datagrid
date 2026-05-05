# Frontend Template

Copy this into a Vue host app and wire it to your backend datasource.

## HTTP Adapter Shape

```ts
export type ServerError = {
  status: number
  code: string
  message: string
  details?: unknown
}

export type WorkspaceSource = "header" | "auth"

export type AuctionsDatasourceHttpAdapterOptions = {
  baseUrl: string
  workspaceId?: string | null
  workspaceSource?: WorkspaceSource
}
```

## Endpoint Mapping

```ts
const endpoints = {
  pull: "/api/auctions/pull",
  histogram: "/api/auctions/histogram",
  edits: "/api/auctions/edits",
  fillBoundary: "/api/auctions/fill-boundary",
  fillCommit: "/api/auctions/fill/commit",
  undo: (operationId: string) => `/api/auctions/operations/${operationId}/undo`,
  redo: (operationId: string) => `/api/auctions/operations/${operationId}/redo`,
}
```

## Pull Implementation

```ts
export async function pull(request: PullRequest, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.pull, request, options)
}
```

The backend must receive:

- range
- sort model
- filter model

## Histogram Implementation

```ts
export async function histogram(request: HistogramRequest, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.histogram, request, options)
}
```

If your grid supports `ignoreSelfFilter`, strip the active column filter before posting.

## Commit Edits Implementation

```ts
export async function commitEdits(request: CommitEditsRequest, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.edits, request, options)
}
```

Preserve:

- `operationId`
- `baseRevision`
- `edits[].rowId`
- `edits[].columnId`
- `edits[].value`
- `edits[].previousValue`

## Fill Boundary Implementation

```ts
export async function resolveFillBoundary(request: FillBoundaryRequest, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.fillBoundary, request, options)
}
```

Preserve the entire projection snapshot that the grid saw when the boundary was resolved.

## Fill Commit Implementation

```ts
export async function commitFill(request: FillCommitRequest, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.fillCommit, request, options)
}
```

Preserve:

- `operationId`
- `baseRevision`
- `projectionHash`
- `boundaryToken`
- `sourceRange`
- `targetRange`
- `sourceRowIds`
- `targetRowIds`
- `fillColumns`
- `referenceColumns`
- `mode`
- `projection`
- `metadata`

## Undo / Redo Implementation

```ts
export async function undoOperation(operationId: string, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.undo(operationId), {}, options)
}

export async function redoOperation(operationId: string, options: AuctionsDatasourceHttpAdapterOptions) {
  return await postJson(endpoints.redo(operationId), {}, options)
}
```

Undo/redo should use the same workspace header logic as pull and writes.

## Warning / Error Propagation

```ts
async function postJson(path: string, body: unknown, options: AuctionsDatasourceHttpAdapterOptions) {
  const response = await fetch(`${options.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.workspaceId ? { "X-Workspace-Id": options.workspaceId } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await tryParseJson(response)
    throw {
      status: response.status,
      code: payload?.code ?? "unknown_error",
      message: payload?.message ?? response.statusText,
      details: payload,
    } satisfies ServerError
  }

  return await response.json()
}
```

Surface backend warnings in the UI instead of dropping them.

## Vue Usage Example

```vue
<script setup lang="ts">
import { computed } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import { createAuctionsDatasourceHttpAdapter } from "@/features/auctions/adapter"

const datasource = createAuctionsDatasourceHttpAdapter({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  workspaceId: "workspace-a",
  workspaceSource: "header",
})

const gridProps = computed(() => ({
  dataSource: datasource,
  tableId: "auctions",
}))
</script>

<template>
  <DataGrid v-bind="gridProps" />
</template>
```

## Practical Notes

- Keep the adapter thin.
- Do not reimplement fill or revision logic in the browser.
- If the host app later binds workspace to auth, keep the adapter API but change how it derives the header value.
