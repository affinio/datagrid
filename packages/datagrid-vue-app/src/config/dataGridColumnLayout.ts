export interface DataGridColumnLayoutLabels {
  buttonLabel?: string
  eyebrow?: string
  title?: string
  close?: string
  cancel?: string
  apply?: string
  moveUp?: string
  moveDown?: string
}

export interface DataGridResolvedColumnLayoutLabels {
  buttonLabel: string
  eyebrow: string
  title: string
  close: string
  cancel: string
  apply: string
  moveUp: string
  moveDown: string
}

export interface DataGridColumnLayoutOptions {
  enabled: boolean
  buttonLabel: string
  labels: DataGridResolvedColumnLayoutLabels
}

export type DataGridColumnLayoutProp =
  | boolean
  | {
      enabled?: boolean
      buttonLabel?: string
      labels?: DataGridColumnLayoutLabels
    }
  | null

const DEFAULT_BUTTON_LABEL = "Columns"

export const DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS: DataGridResolvedColumnLayoutLabels = Object.freeze({
  buttonLabel: DEFAULT_BUTTON_LABEL,
  eyebrow: "Column layout",
  title: "Order and visibility",
  close: "Close",
  cancel: "Cancel",
  apply: "Apply",
  moveUp: "Move up",
  moveDown: "Move down",
})

function resolveLabel(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function resolveColumnLayoutLabels(
  input: DataGridColumnLayoutLabels | undefined,
  legacyButtonLabel?: string,
): DataGridResolvedColumnLayoutLabels {
  const buttonLabel = resolveLabel(legacyButtonLabel, resolveLabel(input?.buttonLabel, DEFAULT_BUTTON_LABEL))
  return Object.freeze({
    buttonLabel,
    eyebrow: resolveLabel(input?.eyebrow, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.eyebrow),
    title: resolveLabel(input?.title, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.title),
    close: resolveLabel(input?.close, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.close),
    cancel: resolveLabel(input?.cancel, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.cancel),
    apply: resolveLabel(input?.apply, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.apply),
    moveUp: resolveLabel(input?.moveUp, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.moveUp),
    moveDown: resolveLabel(input?.moveDown, DEFAULT_DATAGRID_COLUMN_LAYOUT_LABELS.moveDown),
  })
}

export function resolveDataGridColumnLayout(
  input: DataGridColumnLayoutProp | undefined,
): DataGridColumnLayoutOptions {
  if (typeof input === "boolean") {
    const labels = resolveColumnLayoutLabels(undefined)
    return {
      enabled: input,
      buttonLabel: labels.buttonLabel,
      labels,
    }
  }
  if (!input) {
    const labels = resolveColumnLayoutLabels(undefined)
    return {
      enabled: false,
      buttonLabel: labels.buttonLabel,
      labels,
    }
  }
  const labels = resolveColumnLayoutLabels(input.labels, input.buttonLabel)
  return {
    enabled: input.enabled ?? true,
    buttonLabel: labels.buttonLabel,
    labels,
  }
}
