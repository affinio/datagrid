export interface AdapterDiagnostics {
  initialized: boolean
  disposed: boolean
  syncCount: number
}

export interface AdapterLifecycle<InitInput, SyncInput, Diagnostics extends AdapterDiagnostics = AdapterDiagnostics> {
  init(input?: InitInput): void
  sync(input: SyncInput): void
  teardown(): void
  diagnostics(): Diagnostics
}
