export type DataGridSemver = `${number}.${number}.${number}`;
export interface DataGridDeprecationWindow {
    id: string;
    deprecatedIn: DataGridSemver;
    removeIn: DataGridSemver;
    replacement: string;
    codemodCommand?: string;
    notes?: string;
}
export type DataGridDeprecationStatus = "active" | "warning" | "removal-ready";
export interface DataGridDeprecationSnapshot extends DataGridDeprecationWindow {
    status: DataGridDeprecationStatus;
}
export interface DataGridVersionedPublicProtocol {
    protocolVersion: DataGridSemver;
    packageVersion: DataGridSemver;
    stableEntrypoints: readonly string[];
    advancedEntrypoints: readonly string[];
    internalEntrypoints: readonly string[];
    forbiddenDeepImportPatterns: readonly string[];
    semverRules: readonly string[];
    deprecations: readonly DataGridDeprecationSnapshot[];
}
export declare const DATAGRID_PUBLIC_PROTOCOL_VERSION: DataGridSemver;
export declare const DATAGRID_PUBLIC_PACKAGE_VERSION: DataGridSemver;
export declare const DATAGRID_STABLE_ENTRYPOINTS: readonly ["@affino/datagrid-core", "@affino/datagrid-vue"];
export declare const DATAGRID_ADVANCED_ENTRYPOINTS: readonly ["@affino/datagrid-core/advanced"];
export declare const DATAGRID_INTERNAL_ENTRYPOINTS: readonly ["@affino/datagrid-core/internal"];
export declare const DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS: readonly ["@affino/datagrid-core/src/*", "@affino/datagrid-core/viewport/*", "@affino/datagrid-vue/src/*"];
export declare const DATAGRID_SEMVER_RULES: readonly ["Only package root entrypoints are semver-safe for consumers.", "Advanced entrypoints are supported for power users and may evolve with tighter deprecation periods.", "Internal entrypoints are explicitly unsafe and are not covered by semver guarantees.", "Deep imports under /src and internal feature folders are unsupported for public integrations.", "Deprecated APIs remain supported until removeIn version, then can be removed in the next minor/major period.", "All deprecations must provide a replacement and codemod command before removal-ready status."];
export declare const DATAGRID_DEPRECATION_WINDOWS: readonly DataGridDeprecationWindow[];
export declare function compareDatagridSemver(left: string, right: string): number;
export declare function resolveDatagridDeprecationStatus(packageVersion: string, entry: DataGridDeprecationWindow): DataGridDeprecationStatus;
export declare function getDataGridVersionedPublicProtocol(packageVersion?: DataGridSemver): DataGridVersionedPublicProtocol;
//# sourceMappingURL=versionedPublicProtocol.d.ts.map