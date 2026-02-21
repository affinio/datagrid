export type DataGridDependencyKind = "structural" | "computed";
export type DataGridDependencyCyclePolicy = "throw" | "allow";
export interface DataGridFieldDependency {
    sourceField: string;
    dependentField: string;
    kind?: DataGridDependencyKind;
}
export interface DataGridRegisterDependencyOptions {
    kind?: DataGridDependencyKind;
}
export interface CreateDataGridDependencyGraphOptions {
    cyclePolicy?: DataGridDependencyCyclePolicy;
}
export interface DataGridDependencyGraph {
    registerDependency: (sourceField: string, dependentField: string, options?: DataGridRegisterDependencyOptions) => void;
    getAffectedFields: (changedFields: ReadonlySet<string>) => ReadonlySet<string>;
    affectsAny: (changedFields: ReadonlySet<string>, dependencyFields: ReadonlySet<string>) => boolean;
}
export declare function createDataGridDependencyGraph(initialDependencies?: readonly DataGridFieldDependency[], options?: CreateDataGridDependencyGraphOptions): DataGridDependencyGraph;
//# sourceMappingURL=dependencyGraph.d.ts.map