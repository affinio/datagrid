import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue"

interface UseDataGridDiagnosticsPanelOptions<TSnapshot> {
  readDiagnostics: () => TSnapshot | null
}

export interface UseDataGridDiagnosticsPanelResult<TSnapshot> {
  isDiagnosticsPanelOpen: ComputedRef<boolean>
  diagnosticsSnapshot: ComputedRef<TSnapshot | null>
  openDiagnosticsPanel: () => void
  closeDiagnosticsPanel: () => void
  refreshDiagnosticsPanel: () => void
}

export function useDataGridDiagnosticsPanel<TSnapshot>(
  options: UseDataGridDiagnosticsPanelOptions<TSnapshot>,
): UseDataGridDiagnosticsPanelResult<TSnapshot> {
  const isOpen: ShallowRef<boolean> = shallowRef(false)
  const snapshot: ShallowRef<unknown> = shallowRef(null)

  const refreshDiagnosticsPanel = (): void => {
    snapshot.value = options.readDiagnostics()
  }

  const openDiagnosticsPanel = (): void => {
    isOpen.value = true
    refreshDiagnosticsPanel()
  }

  const closeDiagnosticsPanel = (): void => {
    isOpen.value = false
  }

  return {
    isDiagnosticsPanelOpen: computed(() => isOpen.value),
    diagnosticsSnapshot: computed(() => snapshot.value as TSnapshot | null),
    openDiagnosticsPanel,
    closeDiagnosticsPanel,
    refreshDiagnosticsPanel,
  }
}
