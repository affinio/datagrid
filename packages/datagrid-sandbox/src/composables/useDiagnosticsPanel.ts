import { computed, ref, type ComputedRef } from "vue"

interface UseDiagnosticsPanelOptions<TSnapshot> {
  readDiagnostics: () => TSnapshot
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
  const isOpen = ref(false)
  const snapshot = ref<TSnapshot | null>(null)

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
    diagnosticsSnapshot: computed(() => snapshot.value),
    openDiagnosticsPanel,
    closeDiagnosticsPanel,
    refreshDiagnosticsPanel,
  }
}
