import { computed, shallowRef, type ComputedRef } from "vue"

interface UseDiagnosticsPanelOptions<TSnapshot> {
  readDiagnostics: () => TSnapshot | null
}

export interface UseDiagnosticsPanelResult<TSnapshot> {
  isDiagnosticsPanelOpen: ComputedRef<boolean>
  diagnosticsSnapshot: ComputedRef<TSnapshot | null>
  openDiagnosticsPanel: () => void
  closeDiagnosticsPanel: () => void
  refreshDiagnosticsPanel: () => void
}

export function useDiagnosticsPanel<TSnapshot>(
  options: UseDiagnosticsPanelOptions<TSnapshot>,
): UseDiagnosticsPanelResult<TSnapshot> {
  const isOpen = shallowRef(false)
  const snapshot = shallowRef<TSnapshot | null>(null)

  const refreshDiagnosticsPanel = (): void => {
    snapshot.value = options.readDiagnostics() as TSnapshot | null
  }

  const openDiagnosticsPanel = (): void => {
    isOpen.value = true
    refreshDiagnosticsPanel()
  }

  const closeDiagnosticsPanel = (): void => {
    isOpen.value = false
  }

  const diagnosticsSnapshot = computed<TSnapshot | null>(() => (
    snapshot.value as TSnapshot | null
  ))

  return {
    isDiagnosticsPanelOpen: computed<boolean>(() => isOpen.value),
    diagnosticsSnapshot,
    openDiagnosticsPanel,
    closeDiagnosticsPanel,
    refreshDiagnosticsPanel,
  }
}
