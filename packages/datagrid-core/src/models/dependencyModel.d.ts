export type DataGridDependencyTokenDomain = "field" | "computed" | "meta";
export type DataGridDependencyToken = `field:${string}` | `computed:${string}` | `meta:${string}`;
export interface DataGridFieldNode {
    kind: "field";
    token: `field:${string}`;
    path: string;
}
export interface DataGridComputedNode {
    kind: "computed";
    token: `computed:${string}`;
    name: string;
}
export interface DataGridMetaNode {
    kind: "meta";
    token: `meta:${string}`;
    key: string;
}
export type DataGridDependencyNode = DataGridFieldNode | DataGridComputedNode | DataGridMetaNode;
export type DataGridDependencyEdgeKind = "structural" | "computed";
export interface DataGridDependencyEdge {
    kind: DataGridDependencyEdgeKind;
    source: DataGridDependencyNode;
    target: DataGridDependencyNode;
}
export interface CreateDataGridDependencyEdgeInput {
    sourceToken: string;
    targetToken: string;
    kind?: DataGridDependencyEdgeKind;
    sourceFallbackDomain?: DataGridDependencyTokenDomain;
    targetFallbackDomain?: DataGridDependencyTokenDomain;
}
export declare function isDataGridDependencyTokenDomain(value: string): value is DataGridDependencyTokenDomain;
export declare function normalizeDataGridDependencyToken(token: string, fallbackDomain?: DataGridDependencyTokenDomain): DataGridDependencyToken;
export declare function parseDataGridDependencyNode(token: string, fallbackDomain?: DataGridDependencyTokenDomain): DataGridDependencyNode;
export declare function createDataGridDependencyEdge(input: CreateDataGridDependencyEdgeInput): DataGridDependencyEdge;
//# sourceMappingURL=dependencyModel.d.ts.map