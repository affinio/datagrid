type SchedulerPriority = "high" | "normal" | "low";
export interface ScheduleOptions {
    priority?: SchedulerPriority;
    immediate?: boolean;
}
export interface ScheduledTask {
    id: number;
    callback: () => void;
    priority: SchedulerPriority;
}
export interface RafScheduler {
    schedule(callback: () => void, options?: ScheduleOptions): number;
    cancel(taskId: number): void;
    flush(): void;
    runNow(callback: () => void): void;
    dispose(): void;
}
export declare function createRafScheduler(): RafScheduler;
export {};
//# sourceMappingURL=rafScheduler.d.ts.map