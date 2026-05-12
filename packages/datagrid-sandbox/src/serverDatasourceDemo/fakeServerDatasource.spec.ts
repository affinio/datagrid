// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridDataSourcePullRequest } from "@affino/datagrid-vue"
import { createFakeServerDatasource } from "./fakeServerDatasource"
import type { ServerDemoPullDiagnostics } from "./types"

function createPullRequest(): DataGridDataSourcePullRequest {
  const controller = new AbortController()
  return {
    range: { start: 50_000, end: 50_049 },
    priority: "critical",
    reason: "viewport-change",
    signal: controller.signal,
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
    treeData: null,
    pivot: null,
    pagination: {
      snapshot: {
        enabled: false,
        pageSize: 50,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 49,
      },
      cursor: null,
    },
  }
}

describe("createFakeServerDatasource", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("uses the configured pull delay and reports it through diagnostics", async () => {
    vi.useFakeTimers()
    const diagnostics: ServerDemoPullDiagnostics[] = []
    const datasource = createFakeServerDatasource({
      resolvePullDelayMs: request => request.range.start === 50_000 ? 25 : 0,
      onPullDiagnostics: state => {
        diagnostics.push(state)
      },
    })

    const pull = datasource.dataSource.pull(createPullRequest())
    await Promise.resolve()

    expect(diagnostics.some(state => state.latencyMs === 25 && state.loading)).toBe(true)

    await vi.advanceTimersByTimeAsync(25)
    const result = await pull

    expect(result.total).toBe(100_000)
    expect(result.rows).toHaveLength(50)
    expect(diagnostics[diagnostics.length - 1]).toMatchObject({
      latencyMs: 25,
      loading: false,
      pendingRequests: 0,
    })
  })
})
