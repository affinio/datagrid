export interface DataGridCellComboboxState {
  open: boolean
  filter: string
  activeIndex: number
}

export function createDataGridCellComboboxState(
  initial: Partial<DataGridCellComboboxState> = {},
): DataGridCellComboboxState {
  return {
    open: initial.open ?? false,
    filter: initial.filter ?? "",
    activeIndex: initial.activeIndex ?? -1,
  }
}

export function setDataGridCellComboboxOpen(
  state: DataGridCellComboboxState,
  open: boolean,
): DataGridCellComboboxState {
  if (state.open === open) {
    return state
  }
  return {
    ...state,
    open,
  }
}

export function setDataGridCellComboboxFilter(
  state: DataGridCellComboboxState,
  filter: string,
): DataGridCellComboboxState {
  if (state.filter === filter) {
    return state
  }
  return {
    ...state,
    filter,
  }
}

export function activateDataGridCellComboboxIndex(
  state: DataGridCellComboboxState,
  index: number,
  optionCount: number,
): DataGridCellComboboxState {
  const nextIndex = clampIndex(index, optionCount)
  if (nextIndex === state.activeIndex) {
    return state
  }
  return {
    ...state,
    activeIndex: nextIndex,
  }
}

export function moveDataGridCellComboboxFocus(
  state: DataGridCellComboboxState,
  delta: number,
  optionCount: number,
  loop = true,
): DataGridCellComboboxState {
  if (optionCount <= 0 || delta === 0) {
    return state
  }
  if (state.activeIndex < 0) {
    return activateDataGridCellComboboxIndex(state, delta > 0 ? 0 : optionCount - 1, optionCount)
  }
  const rawTarget = state.activeIndex + Math.trunc(delta)
  if (loop) {
    return activateDataGridCellComboboxIndex(state, modulo(rawTarget, optionCount), optionCount)
  }
  return activateDataGridCellComboboxIndex(state, rawTarget, optionCount)
}

function clampIndex(index: number, optionCount: number): number {
  if (optionCount <= 0) {
    return -1
  }
  if (!Number.isFinite(index)) {
    return 0
  }
  const normalized = Math.trunc(index)
  if (normalized < 0) {
    return 0
  }
  if (normalized >= optionCount) {
    return optionCount - 1
  }
  return normalized
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}