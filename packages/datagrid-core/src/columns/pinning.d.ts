import type { ColumnPinMode } from "../virtualization/types";
export interface CanonicalPinColumn {
    isSystem?: boolean;
    pin?: unknown;
}
/**
 * Runtime canonical pin resolver.
 * Legacy fields are intentionally excluded from this contract.
 */
export declare function resolveCanonicalPinMode(column: CanonicalPinColumn | null | undefined): ColumnPinMode;
//# sourceMappingURL=pinning.d.ts.map