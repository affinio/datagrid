export interface DataGridTabTargetCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridTabTargetNextCoord {
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridTabTargetResolverOptions<TCoord extends DataGridTabTargetCoord> {
  resolveNavigableColumnIndexes: () => readonly number[]
  normalizeCellCoord: (next: DataGridTabTargetNextCoord) => TCoord | null
}

export interface UseDataGridTabTargetResolverResult<TCoord extends DataGridTabTargetCoord> {
  resolveTabTarget: (current: TCoord, backwards: boolean) => TCoord | null
}

export function useDataGridTabTargetResolver<TCoord extends DataGridTabTargetCoord>(
  options: UseDataGridTabTargetResolverOptions<TCoord>,
): UseDataGridTabTargetResolverResult<TCoord> {
  function resolveTabTarget(current: TCoord, backwards: boolean): TCoord | null {
    const columns = options.resolveNavigableColumnIndexes()
    if (!columns.length) {
      return null
    }

    const currentPos = columns.indexOf(current.columnIndex)
    const resolvedPos = currentPos === -1
      ? columns.findIndex(index => index >= current.columnIndex)
      : currentPos
    const startPos = resolvedPos === -1 ? (backwards ? columns.length - 1 : 0) : resolvedPos

    let rowIndex = current.rowIndex
    let columnPos = startPos + (backwards ? -1 : 1)
    if (columnPos < 0) {
      columnPos = columns.length - 1
      rowIndex -= 1
    } else if (columnPos >= columns.length) {
      columnPos = 0
      rowIndex += 1
    }

    return options.normalizeCellCoord({
      rowIndex,
      columnIndex: columns[columnPos] ?? columns[0] ?? 0,
    })
  }

  return {
    resolveTabTarget,
  }
}
