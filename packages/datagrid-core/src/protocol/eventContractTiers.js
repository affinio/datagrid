export const DATAGRID_EVENT_TIERS = ["stable", "advanced", "internal"];
export const DATAGRID_EVENT_TIER_ENTRYPOINTS = {
    stable: "@affino/datagrid-core",
    advanced: "@affino/datagrid-core/advanced",
    internal: "@affino/datagrid-core/internal",
};
export function isDataGridEventTier(value) {
    return DATAGRID_EVENT_TIERS.includes(value);
}
export function createDataGridEventEnvelope(input) {
    return {
        ...input,
        timestampMs: input.timestampMs ?? 0,
    };
}
