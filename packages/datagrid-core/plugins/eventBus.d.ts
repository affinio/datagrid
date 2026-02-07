import type { UiTablePluginEventHandler } from "./types";
export declare class UiTablePluginEventBus {
    private listeners;
    on(event: string, handler: UiTablePluginEventHandler): void;
    off(event: string, handler: UiTablePluginEventHandler): void;
    emit(event: string, ...args: any[]): void;
    clear(): void;
}
//# sourceMappingURL=eventBus.d.ts.map