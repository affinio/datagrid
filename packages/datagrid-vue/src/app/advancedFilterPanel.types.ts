export type DataGridAppAdvancedFilterClauseJoin = "and" | "or"

export interface DataGridAppAdvancedFilterClauseDraft {
  id: number
  join: DataGridAppAdvancedFilterClauseJoin
  columnKey: string
  operator: string
  value: string
}

export interface DataGridAppAdvancedFilterColumnOption {
  key: string
  label: string
}

export interface DataGridAppAdvancedFilterClausePatch {
  clauseId: number
  field: "join" | "columnKey" | "operator" | "value"
  value: string
}
