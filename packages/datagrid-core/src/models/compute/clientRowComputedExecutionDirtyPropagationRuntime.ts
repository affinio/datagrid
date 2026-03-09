export interface DataGridComputedDirtyPropagationRuntime {
  dirtyRowIndexesByNode: Array<number[] | undefined>
  dirtyNodeMarks: Uint8Array
  dirtyAllRowsByNode: Uint32Array
  dirtyFieldCauseCountsByNode: Array<Map<string, number> | undefined>
  dirtyComputedCauseCountsByNode: Array<Map<string, number> | undefined>
  dirtyContextCauseCountsByNode: Array<Map<string, number> | undefined>
  dirtyRowCauseKeysByNode: Array<Map<number, Set<string>> | undefined>
  dirtyRowCountByNode: Uint32Array
  evaluationCountByNode: Uint32Array
  incrementCauseCount: (
    bucketByNode: Array<Map<string, number> | undefined>,
    nodeIndex: number,
    value: string,
  ) => void
  markDirtyRowForNode: (nodeIndex: number, rowIndex: number) => void
  recordDirtyCauseForNodeRow: (
    nodeIndex: number,
    rowIndex: number,
    kind: "all" | "field" | "computed" | "context",
    value?: string,
  ) => void
  markDirtyRow: (rowIndex: number) => void
  markDirtyNode: (nodeIndex: number) => void
  enqueueDirtyNodeRowIndex: (nodeIndex: number, rowIndex: number) => void
  getDirtyNodeCount: () => number
  getDirtyRowsCount: () => number
}

export function createDataGridComputedDirtyPropagationRuntime(
  nodeCount: number,
  rowCount: number,
  options: {
    captureCauseCounts?: boolean
    captureRowCauseKeys?: boolean
  } = {},
): DataGridComputedDirtyPropagationRuntime {
  const captureCauseCounts = options.captureCauseCounts !== false
  const captureRowCauseKeys = options.captureRowCauseKeys !== false
  const dirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
  const dirtyNodeMarks = new Uint8Array(nodeCount)
  let dirtyNodeCount = 0
  const dirtyAllRowsByNode = new Uint32Array(nodeCount)
  const dirtyFieldCauseCountsByNode = new Array<Map<string, number> | undefined>(nodeCount)
  const dirtyComputedCauseCountsByNode = new Array<Map<string, number> | undefined>(nodeCount)
  const dirtyContextCauseCountsByNode = new Array<Map<string, number> | undefined>(nodeCount)
  const dirtyRowCauseKeysByNode = new Array<Map<number, Set<string>> | undefined>(nodeCount)
  const dirtyRowSeenByNode = new Array<Set<number> | undefined>(nodeCount)
  const dirtyRowCountByNode = new Uint32Array(nodeCount)
  const evaluationCountByNode = new Uint32Array(nodeCount)
  const dirtyRowMarks = new Uint8Array(rowCount)
  let dirtyRowsCount = 0

  const incrementCauseCount = (
    bucketByNode: Array<Map<string, number> | undefined>,
    nodeIndex: number,
    value: string,
  ): void => {
    if (!captureCauseCounts) {
      return
    }
    if (value.length === 0) {
      return
    }
    let bucket = bucketByNode[nodeIndex]
    if (!bucket) {
      bucket = new Map<string, number>()
      bucketByNode[nodeIndex] = bucket
    }
    bucket.set(value, (bucket.get(value) ?? 0) + 1)
  }

  const markDirtyRowForNode = (nodeIndex: number, rowIndex: number): void => {
    let seenRows = dirtyRowSeenByNode[nodeIndex]
    if (!seenRows) {
      seenRows = new Set<number>()
      dirtyRowSeenByNode[nodeIndex] = seenRows
    }
    if (seenRows.has(rowIndex)) {
      return
    }
    seenRows.add(rowIndex)
    dirtyRowCountByNode[nodeIndex] = (dirtyRowCountByNode[nodeIndex] ?? 0) + 1
  }

  const recordDirtyCauseForNodeRow = (
    nodeIndex: number,
    rowIndex: number,
    kind: "all" | "field" | "computed" | "context",
    value?: string,
  ): void => {
    if (!captureRowCauseKeys) {
      return
    }
    let causeKeysByRow = dirtyRowCauseKeysByNode[nodeIndex]
    if (!causeKeysByRow) {
      causeKeysByRow = new Map<number, Set<string>>()
      dirtyRowCauseKeysByNode[nodeIndex] = causeKeysByRow
    }
    let causeKeys = causeKeysByRow.get(rowIndex)
    if (!causeKeys) {
      causeKeys = new Set<string>()
      causeKeysByRow.set(rowIndex, causeKeys)
    }
    causeKeys.add(`${kind}\u001f${value ?? ""}`)
  }

  const markDirtyRow = (rowIndex: number): void => {
    if (dirtyRowMarks[rowIndex] !== 0) {
      return
    }
    dirtyRowMarks[rowIndex] = 1
    dirtyRowsCount += 1
  }

  const markDirtyNode = (nodeIndex: number): void => {
    if (dirtyNodeMarks[nodeIndex] !== 0) {
      return
    }
    dirtyNodeMarks[nodeIndex] = 1
    dirtyNodeCount += 1
  }

  const enqueueDirtyNodeRowIndex = (nodeIndex: number, rowIndex: number): void => {
    let nodeDirtyRows = dirtyRowIndexesByNode[nodeIndex]
    if (!nodeDirtyRows) {
      nodeDirtyRows = []
      dirtyRowIndexesByNode[nodeIndex] = nodeDirtyRows
    }
    nodeDirtyRows.push(rowIndex)
    markDirtyRowForNode(nodeIndex, rowIndex)
    markDirtyNode(nodeIndex)
    markDirtyRow(rowIndex)
  }

  return {
    dirtyRowIndexesByNode,
    dirtyNodeMarks,
    dirtyAllRowsByNode,
    dirtyFieldCauseCountsByNode,
    dirtyComputedCauseCountsByNode,
    dirtyContextCauseCountsByNode,
    dirtyRowCauseKeysByNode,
    dirtyRowCountByNode,
    evaluationCountByNode,
    incrementCauseCount,
    markDirtyRowForNode,
    recordDirtyCauseForNodeRow,
    markDirtyRow,
    markDirtyNode,
    enqueueDirtyNodeRowIndex,
    getDirtyNodeCount: () => dirtyNodeCount,
    getDirtyRowsCount: () => dirtyRowsCount,
  }
}
