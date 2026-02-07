export interface MeasurementHandle<T> {
    promise: Promise<T>;
    cancel(): void;
}
export interface MeasurementQueue {
    schedule<T>(measure: () => T): MeasurementHandle<T>;
    flush(): void;
    dispose(): void;
}
export interface CreateMeasurementQueueOptions {
    globalObject?: typeof globalThis;
}
export declare function createMeasurementQueue(options?: CreateMeasurementQueueOptions): MeasurementQueue;
export declare function scheduleMeasurement<T>(measure: () => T): MeasurementHandle<T>;
export declare function flushMeasurements(): void;
export declare function disposeDefaultMeasurementQueue(): void;
//# sourceMappingURL=measurementQueue.d.ts.map