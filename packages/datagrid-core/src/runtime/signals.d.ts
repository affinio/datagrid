export interface WritableSignal<T> {
    value: T;
}
export type CreateWritableSignal<T> = (initial: T) => WritableSignal<T>;
export declare function createWritableSignal<T>(initial: T): WritableSignal<T>;
//# sourceMappingURL=signals.d.ts.map