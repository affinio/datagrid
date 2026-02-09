export interface FilterConditionClause {
	id: string
	operator: string
	value: unknown
	value2?: unknown
	join?: "and" | "or"
}

export interface FilterCondition {
	type: "text" | "number" | "date"
	clauses: FilterConditionClause[]
}

export interface AdvancedFilterConditionNode {
	kind: "condition"
	key: string
	field?: string
	type?: "text" | "number" | "date" | "boolean"
	operator: string
	value?: unknown
	value2?: unknown
}

export interface AdvancedFilterGroupNode {
	kind: "group"
	operator: "and" | "or"
	children: AdvancedFilterExpressionNode[]
}

export interface AdvancedFilterNotNode {
	kind: "not"
	child: AdvancedFilterExpressionNode
}

export type AdvancedFilterExpressionNode =
	| AdvancedFilterConditionNode
	| AdvancedFilterGroupNode
	| AdvancedFilterNotNode

export interface FilterMenuState {
	columnKey: string | null
	search: string
	selectedKeys: string[]
}

export interface FilterStateSnapshot {
	columnFilters: Record<string, string[]>
	advancedFilters: Record<string, FilterCondition>
	advancedExpression?: AdvancedFilterExpressionNode | null
}
