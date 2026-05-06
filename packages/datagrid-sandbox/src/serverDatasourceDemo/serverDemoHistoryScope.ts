export interface ServerDemoHistoryScope {
  workspace_id: string
  table_id: string
  session_id: string
  user_id?: string
}

export interface ServerDemoHistoryScopeEnv {
  [key: string]: string | undefined
  VITE_SERVER_DEMO_WORKSPACE_ID?: string
  VITE_SERVER_DEMO_SESSION_ID?: string
  VITE_SERVER_DEMO_USER_ID?: string
}

const DEFAULT_SERVER_DEMO_HISTORY_SCOPE: ServerDemoHistoryScope = {
  workspace_id: "server-demo-sandbox",
  table_id: "server_demo",
  session_id: "server-demo-session",
}

function resolveTrimmedValue(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function createServerDemoHistoryScope(
  overrides: Partial<ServerDemoHistoryScope> = {},
): ServerDemoHistoryScope {
  return {
    ...DEFAULT_SERVER_DEMO_HISTORY_SCOPE,
    ...overrides,
  }
}

export function resolveServerDemoHistoryScopeFromEnv(
  env: ServerDemoHistoryScopeEnv = import.meta.env as ServerDemoHistoryScopeEnv,
): ServerDemoHistoryScope {
  return createServerDemoHistoryScope({
    workspace_id: resolveTrimmedValue(env.VITE_SERVER_DEMO_WORKSPACE_ID) ?? DEFAULT_SERVER_DEMO_HISTORY_SCOPE.workspace_id,
    session_id: resolveTrimmedValue(env.VITE_SERVER_DEMO_SESSION_ID) ?? DEFAULT_SERVER_DEMO_HISTORY_SCOPE.session_id,
    user_id: resolveTrimmedValue(env.VITE_SERVER_DEMO_USER_ID),
  })
}
