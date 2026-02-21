import type { WritableSignal } from "../runtime/signals";
import type { RafScheduler } from "../runtime/rafScheduler";
import type { ViewportClock } from "./dataGridViewportConfig";
interface DiagnosticsSignals {
    debugMode: WritableSignal<boolean>;
    fps: WritableSignal<number>;
    frameTime: WritableSignal<number>;
    droppedFrames: WritableSignal<number>;
    layoutReads: WritableSignal<number>;
    layoutWrites: WritableSignal<number>;
    syncScrollRate: WritableSignal<number>;
    heavyUpdateRate: WritableSignal<number>;
    virtualizerUpdates: WritableSignal<number>;
    virtualizerSkips: WritableSignal<number>;
}
export interface DataGridViewportDiagnosticsOptions {
    scheduler: RafScheduler;
    clock: ViewportClock;
    signals: DiagnosticsSignals;
}
export interface DataGridViewportDiagnostics {
    recordLayoutRead: (count?: number) => void;
    recordLayoutWrite: (count?: number) => void;
    recordSyncScroll: () => void;
    recordHeavyPass: () => void;
    recordVirtualizerUpdate: () => void;
    recordVirtualizerSkip: () => void;
    setDebugMode: (enabled: boolean) => void;
    isDebugEnabled: () => boolean;
    dispose: () => void;
}
export declare function createDataGridViewportDiagnostics(options: DataGridViewportDiagnosticsOptions): DataGridViewportDiagnostics;
export {};
//# sourceMappingURL=dataGridViewportDiagnostics.d.ts.map