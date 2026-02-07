export interface OverscanResolutionInput {
    available: number;
    direction: number;
}
export interface OverscanResolutionResult {
    leading: number;
    trailing: number;
}
export declare function resolveOverscanBuckets({ available, direction }: OverscanResolutionInput): OverscanResolutionResult;
//# sourceMappingURL=axisMath.d.ts.map