export type AdvancedFilterClauseJoin = "and" | "or"

export interface AdvancedFilterClauseDraft {
  id: number
  join: AdvancedFilterClauseJoin
  columnKey: string
  operator: string
  value: string
}

export interface AdvancedFilterColumnOption {
  key: string
  label: string
}

export interface AdvancedFilterClausePatch {
  clauseId: number
  field: "join" | "columnKey" | "operator" | "value"
  value: string
}
