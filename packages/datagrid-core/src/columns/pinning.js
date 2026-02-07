/**
 * Runtime canonical pin resolver.
 * Legacy fields are intentionally excluded from this contract.
 */
export function resolveCanonicalPinMode(column) {
    if (!column)
        return "none";
    if (column.isSystem === true)
        return "left";
    return column.pin === "left" || column.pin === "right" ? column.pin : "none";
}
