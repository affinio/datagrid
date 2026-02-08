import { defaultThemeTokens } from "./defaultThemeTokens"
import type { DataGridResolvedStyleConfig } from "./types"

export const defaultStyleConfig: DataGridResolvedStyleConfig = {
  table: {
    wrapper: "",
    container: "",
  },
  header: {
    row: "",
    cell: "",
    selectionCell: "",
    indexCell: "",
  },
  body: {
    row: "",
    cell: "",
    selectionCell: "",
    indexCell: "",
  },
  group: {
    row: "",
    cell: "",
    caret: "",
  },
  summary: {
    row: "",
    cell: "",
    labelCell: "",
  },
  state: {
    selectedRow: "",
  },
  tokens: defaultThemeTokens,
}
