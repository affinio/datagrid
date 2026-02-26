export interface FilterConditionClause {
	id: string
	operator: string
	value: unknown
	value2?: unknown
	join?: "and" | "or"
}

export interface FilterCondition {
	type: "text" | "number" | "date" | "set"
	clauses: FilterConditionClause[]
}

export interface AdvancedFilterConditionNode {
	kind: "condition"
	key: string
	field?: string
	type?: "text" | "number" | "date" | "set" | "boolean"
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
	columnFilters: Record<string, FilterColumnEntry>
	advancedFilters: Record<string, FilterCondition>
	advancedExpression?: AdvancedFilterExpressionNode | null
}

export interface FilterColumnValueSetEntry {
	kind: "valueSet"
	tokens: string[]
}

export interface FilterColumnPredicateEntry {
	kind: "predicate"
	operator: "contains" | "startsWith" | "endsWith" | "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte" | "isEmpty" | "notEmpty" | "isNull" | "notNull"
	value?: unknown
	value2?: unknown
	caseSensitive?: boolean
}

export type FilterColumnEntry = string[] | FilterColumnValueSetEntry | FilterColumnPredicateEntry
