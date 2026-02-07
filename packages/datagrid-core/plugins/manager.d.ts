import type { UiTablePluginDefinition } from "./types";
type HostEmit = (event: string, ...args: any[]) => void;
interface ManagerOptions {
    getTableId: () => string;
    getRootElement: () => HTMLElement | null;
    getHostExpose: () => Record<string, unknown>;
    emitHostEvent: HostEmit;
}
export declare class UiTablePluginManager {
    private readonly bus;
    private readonly instances;
    private readonly options;
    constructor(options: ManagerOptions);
    setPlugins(definitions: Array<UiTablePluginDefinition | null | undefined>): void;
    notify(event: string, ...args: any[]): void;
    emit(event: string, ...args: any[]): void;
    destroy(): void;
    private installPlugin;
    private disposePlugin;
}
export {};
//# sourceMappingURL=manager.d.ts.map