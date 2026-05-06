export interface ServerDemoChangeFeedPollingConfig {
  httpModeEnabled: boolean
  envValue?: string | null
  intervalValue?: string | number | null
}

export function resolveServerDemoChangeFeedPollingEnabled(config: ServerDemoChangeFeedPollingConfig): boolean {
  if (!config.httpModeEnabled) {
    return false
  }
  return config.envValue !== "false"
}

export function resolveServerDemoChangeFeedPollingIntervalMs(intervalValue: string | number | null | undefined): number {
  const parsed = typeof intervalValue === "string" ? Number(intervalValue) : intervalValue
  return Math.max(500, Number.isFinite(parsed) ? Number(parsed) : 2000)
}
