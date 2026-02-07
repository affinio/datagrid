interface OverscanState {
    smoothedOverscan: number;
    smoothedVelocity: number;
    lastTimestamp: number;
    lastOverscan: number;
}
export interface VerticalOverscanConfig {
    minOverscan: number;
    velocityRatio?: number;
    viewportRatio?: number;
    decay?: number;
    maxViewportMultiplier?: number;
    teleportMultiplier?: number;
    frameDurationMs?: number;
    minSampleMs?: number;
    blendWindowMs?: number;
}
export interface VerticalOverscanInput {
    timestamp: number;
    delta: number;
    viewportSize: number;
    itemSize: number;
    virtualizationEnabled: boolean;
}
export interface HorizontalOverscanConfig {
    minOverscan: number;
    velocityRatio?: number;
    viewportRatio?: number;
    decay?: number;
    maxViewportMultiplier?: number;
    teleportMultiplier?: number;
    frameDurationMs?: number;
    minSampleMs?: number;
    blendWindowMs?: number;
}
export interface HorizontalOverscanInput {
    timestamp: number;
    delta: number;
    viewportSize: number;
    itemSize: number;
    totalItems: number;
    virtualizationEnabled: boolean;
}
export interface DynamicOverscanResult {
    overscan: number;
    state: Readonly<OverscanState>;
}
export interface VerticalOverscanController {
    update(input: VerticalOverscanInput): DynamicOverscanResult;
    reset(timestamp?: number): void;
    getState(): Readonly<OverscanState>;
}
export interface HorizontalOverscanController {
    update(input: HorizontalOverscanInput): DynamicOverscanResult;
    reset(timestamp?: number, overscanOverride?: number): void;
    getState(): Readonly<OverscanState>;
}
export declare function createVerticalOverscanController(config: VerticalOverscanConfig): VerticalOverscanController;
export declare function createHorizontalOverscanController(config: HorizontalOverscanConfig): HorizontalOverscanController;
export {};
//# sourceMappingURL=dynamicOverscan.d.ts.map