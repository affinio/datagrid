import type { UiTableColumn } from "@affino/datagrid-core/types"

export function isNavigableColumn(column: UiTableColumn | undefined): boolean {
  if (!column) return false
  return column.isSystem !== true
}

export function resolveNavigableColumnIndices(columns: readonly UiTableColumn[]): number[] {
  const indices: number[] = []
  for (let index = 0; index < columns.length; index += 1) {
    if (isNavigableColumn(columns[index])) {
      indices.push(index)
    }
  }
  return indices
}

export function resolveEdgeColumnIndex(
  columns: readonly UiTableColumn[],
  edge: "start" | "end",
): number {
  const navigable = resolveNavigableColumnIndices(columns)
  if (!navigable.length) {
    if (!columns.length) return 0
    return edge === "start" ? 0 : columns.length - 1
  }
  return edge === "start" ? navigable[0]! : navigable[navigable.length - 1]!
}

export function resolveTabColumnTarget(input: {
  columns: readonly UiTableColumn[]
  currentColumnIndex: number
  forward: boolean
}): { nextColumnIndex: number; rowDelta: number } | null {
  const navigable = resolveNavigableColumnIndices(input.columns)
  if (!navigable.length) return null

  const currentPos = navigable.indexOf(input.currentColumnIndex)
  const resolvedPos = currentPos === -1
    ? navigable.findIndex(index => index >= input.currentColumnIndex)
    : currentPos
  const startPos = resolvedPos === -1 ? (input.forward ? 0 : navigable.length - 1) : resolvedPos
  let nextPos = startPos + (input.forward ? 1 : -1)
  let rowDelta = 0

  if (nextPos < 0) {
    nextPos = navigable.length - 1
    rowDelta = -1
  } else if (nextPos >= navigable.length) {
    nextPos = 0
    rowDelta = 1
  }

  return {
    nextColumnIndex: navigable[nextPos] ?? navigable[0]!,
    rowDelta,
  }
}
