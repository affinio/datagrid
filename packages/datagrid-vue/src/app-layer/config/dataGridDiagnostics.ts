export interface DataGridDiagnosticsOptions {
  enabled: boolean
  buttonLabel: string
}

export type DataGridDiagnosticsProp =
  | boolean
  | {
      enabled?: boolean
      buttonLabel?: string
    }
  | null

const DEFAULT_BUTTON_LABEL = "Diagnostics"

export function resolveDataGridDiagnostics(
  input: DataGridDiagnosticsProp | undefined,
): DataGridDiagnosticsOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    }
  }
  if (!input) {
    return {
      enabled: false,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    }
  }
  return {
    enabled: input.enabled ?? true,
    buttonLabel: typeof input.buttonLabel === "string" && input.buttonLabel.trim().length > 0
      ? input.buttonLabel.trim()
      : DEFAULT_BUTTON_LABEL,
  }
}
