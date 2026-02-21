export const DATAGRID_PUBLIC_PROTOCOL_VERSION = "1.0.0";
export const DATAGRID_PUBLIC_PACKAGE_VERSION = "0.1.0";
export const DATAGRID_STABLE_ENTRYPOINTS = [
    "@affino/datagrid-core",
    "@affino/datagrid-vue",
];
export const DATAGRID_ADVANCED_ENTRYPOINTS = [
    "@affino/datagrid-core/advanced",
];
export const DATAGRID_INTERNAL_ENTRYPOINTS = [
    "@affino/datagrid-core/internal",
];
export const DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS = [
    "@affino/datagrid-core/src/*",
    "@affino/datagrid-core/viewport/*",
    "@affino/datagrid-vue/src/*",
];
export const DATAGRID_SEMVER_RULES = [
    "Only package root entrypoints are semver-safe for consumers.",
    "Advanced entrypoints are supported for power users and may evolve with tighter deprecation periods.",
    "Internal entrypoints are explicitly unsafe and are not covered by semver guarantees.",
    "Deep imports under /src and internal feature folders are unsupported for public integrations.",
    "Deprecated APIs remain supported until removeIn version, then can be removed in the next minor/major period.",
    "All deprecations must provide a replacement and codemod command before removal-ready status.",
];
export const DATAGRID_DEPRECATION_WINDOWS = [
    {
        id: "core.viewport.createDataGridViewportController",
        deprecatedIn: "0.2.0",
        removeIn: "0.4.0",
        replacement: "createDataGridViewportController from @affino/datagrid-core/advanced",
        codemodCommand: "pnpm run codemod:datagrid:public-protocol -- --write <path>",
        notes: "Use advanced import and DataGrid-named controller factory.",
    },
    {
        id: "vue.useDataGridViewport.serverIntegration-option",
        deprecatedIn: "0.2.0",
        removeIn: "0.4.0",
        replacement: "rowModel-driven integration via @affino/datagrid-core model contracts",
        codemodCommand: "pnpm run codemod:datagrid:public-protocol -- --write <path>",
        notes: "serverIntegration path is compatibility-only and will be removed after migration period.",
    },
];
function parseSemver(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
    if (!match) {
        throw new Error(`[DataGridPublicProtocol] invalid semver "${value}". Expected "x.y.z".`);
    }
    return {
        major: Number.parseInt(match[1] ?? "0", 10),
        minor: Number.parseInt(match[2] ?? "0", 10),
        patch: Number.parseInt(match[3] ?? "0", 10),
    };
}
export function compareDatagridSemver(left, right) {
    const a = parseSemver(left);
    const b = parseSemver(right);
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    return a.patch - b.patch;
}
export function resolveDatagridDeprecationStatus(packageVersion, entry) {
    if (compareDatagridSemver(packageVersion, entry.deprecatedIn) < 0) {
        return "active";
    }
    if (compareDatagridSemver(packageVersion, entry.removeIn) < 0) {
        return "warning";
    }
    return "removal-ready";
}
export function getDataGridVersionedPublicProtocol(packageVersion = DATAGRID_PUBLIC_PACKAGE_VERSION) {
    return {
        protocolVersion: DATAGRID_PUBLIC_PROTOCOL_VERSION,
        packageVersion,
        stableEntrypoints: DATAGRID_STABLE_ENTRYPOINTS,
        advancedEntrypoints: DATAGRID_ADVANCED_ENTRYPOINTS,
        internalEntrypoints: DATAGRID_INTERNAL_ENTRYPOINTS,
        forbiddenDeepImportPatterns: DATAGRID_FORBIDDEN_DEEP_IMPORT_PATTERNS,
        semverRules: DATAGRID_SEMVER_RULES,
        deprecations: DATAGRID_DEPRECATION_WINDOWS.map((entry) => ({
            ...entry,
            status: resolveDatagridDeprecationStatus(packageVersion, entry),
        })),
    };
}
