import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue"

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
  const isOpen: ShallowRef<boolean> = shallowRef(false)
  const snapshot: ShallowRef<TSnapshot | null> = shallowRef<TSnapshot | null>(null)

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

  const diagnosticsSnapshot = computed<TSnapshot | null>(() => snapshot.value)

  return {
    isDiagnosticsPanelOpen: computed<boolean>(() => isOpen.value),
    diagnosticsSnapshot,
    openDiagnosticsPanel,
    closeDiagnosticsPanel,
    refreshDiagnosticsPanel,
  }
}
