export interface DataGridCodemodResult {
  code: string
  changed: boolean
  appliedTransforms: string[]
}

const ADVANCED_SYMBOLS = new Set([
  "createDataGridViewportController",
  "createDataGridA11yStateMachine",
  "createDataGridAdapterRuntime",
  "createDataGridTransactionService",
  "createDataGridRuntime",
  "createDataSourceBackedRowModel",
  "resolveDataGridAdapterEventName",
  "DataGridRuntime",
  "DataGridRuntimeOptions",
  "DataGridHostEventName",
  "DataGridHostEventArgs",
  "DataGridHostEventMap",
  "DataGridEventArgs",
  "DataGridRuntimeBasePluginEventMap",
  "DataGridRuntimePluginEventMap",
  "DataGridRuntimeInternalEventMap",
  "DataGridRuntimeInternalEventName",
  "DataGridAdapterKind",
  "DataGridKebabHostEventName",
  "DataGridAdapterEventNameByKind",
  "DataGridAdapterRuntimePluginContext",
  "DataGridAdapterDispatchPayload",
  "CreateDataGridAdapterRuntimeOptions",
  "DataGridAdapterRuntime",
  "DataGridTransactionCommand",
  "DataGridTransactionAffectedRange",
  "DataGridTransactionMeta",
  "DataGridTransactionInput",
  "DataGridTransactionSnapshot",
  "DataGridTransactionPendingBatchSnapshot",
  "DataGridTransactionExecutionContext",
  "DataGridTransactionDirection",
  "DataGridTransactionExecutor",
  "DataGridTransactionService",
  "DataGridTransactionServiceHooks",
  "DataGridTransactionAppliedEvent",
  "DataGridTransactionRolledBackEvent",
  "DataGridTransactionHistoryEvent",
  "DataGridTransactionEventEntry",
  "DataGridTransactionListener",
  "CreateDataGridTransactionServiceOptions",
  "CreateDataGridA11yStateMachineOptions",
  "DataGridA11yCellAriaState",
  "DataGridA11yFocusCell",
  "DataGridA11yGridAriaState",
  "DataGridA11yKeyboardCommand",
  "DataGridA11yKeyCommandKey",
  "DataGridA11ySnapshot",
  "DataGridA11yStateListener",
  "DataGridA11yStateMachine",
  "DataGridViewportController",
  "DataGridViewportControllerOptions",
  "DataGridViewportImperativeCallbacks",
  "DataGridViewportRuntimeOverrides",
  "DataGridViewportMetricsSnapshot",
  "DataGridViewportIntegrationSnapshot",
  "DataGridViewportSyncTargets",
  "DataGridViewportSyncState",
  "DataGridViewportState",
  "DataGridRowPoolItem",
  "DataGridImperativeColumnUpdatePayload",
  "DataGridImperativeRowUpdatePayload",
  "DataGridImperativeScrollSyncPayload",
  "CreateDataSourceBackedRowModelOptions",
  "DataSourceBackedRowModel",
  "DataGridDataSource",
  "DataGridDataSourceBackpressureDiagnostics",
  "DataGridDataSourceInvalidation",
  "DataGridDataSourcePullPriority",
  "DataGridDataSourcePullReason",
  "DataGridDataSourcePullRequest",
  "DataGridDataSourcePullResult",
  "DataGridDataSourceTreePullContext",
  "DataGridDataSourceTreePullOperation",
  "DataGridDataSourceTreePullScope",
  "DataGridDataSourcePushEvent",
  "DataGridDataSourcePushInvalidateEvent",
  "DataGridDataSourcePushListener",
  "DataGridDataSourcePushRemoveEvent",
  "DataGridDataSourcePushUpsertEvent",
  "DataGridDataSourceRowEntry",
])

const THEME_SYMBOLS = new Set([
  "applyGridTheme",
  "mergeThemeTokens",
  "resolveGridThemeTokens",
  "THEME_TOKEN_VARIABLE_MAP",
  "defaultThemeTokens",
  "defaultStyleConfig",
  "industrialNeutralTheme",
  "palette",
  "toRgb",
  "toRgba",
  "transparent",
  "normalizeHex",
  "DataGridThemeTokens",
  "DataGridResolvedStyleConfig",
  "DataGridStyleSection",
  "DataGridHeaderStyle",
  "DataGridBodyStyle",
  "DataGridGroupStyle",
  "DataGridSummaryStyle",
  "DataGridStateStyle",
  "DataGridThemeTokenVariants",
  "DataGridStyleConfig",
])

const PLUGIN_SYMBOLS = new Set([
  "DataGridEventMap",
  "DataGridEventName",
  "DataGridEventArgs",
  "DataGridPluginCapability",
  "DataGridPluginCapabilityMap",
  "DataGridPluginCapabilityName",
  "DataGridPluginEventHandler",
  "DataGridPluginSetupContext",
  "DataGridPlugin",
  "DataGridPluginDefinition",
  "DataGridPluginManager",
])

function applyReplace(
  source: string,
  pattern: RegExp,
  replacement: string,
  tag: string,
  appliedTransforms: string[],
): string {
  const next = source.replace(pattern, replacement)
  if (next !== source) {
    appliedTransforms.push(tag)
  }
  return next
}

function normalizeSpecifiers(raw: string): string[] {
  return raw
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
}

function extractImportedName(specifier: string): string | null {
  const withoutType = specifier.replace(/^type\s+/, "").trim()
  const parts = withoutType.split(/\s+as\s+/)
  const imported = (parts[0] ?? "").trim()
  return imported.length > 0 ? imported : null
}

function buildImportLine(specifiers: string[], source: string): string | null {
  if (specifiers.length === 0) {
    return null
  }
  return `import { ${specifiers.join(", ")} } from "${source}"`
}

function rewriteRootImportsToTieredEntrypoints(source: string, appliedTransforms: string[]): string {
  return source.replace(
    /import\s*{([^}]+)}\s*from\s*["']@affino\/datagrid-core["'];?/g,
    (statement, rawSpecifiers: string) => {
      const specifiers = normalizeSpecifiers(rawSpecifiers)
      const stableSpecifiers: string[] = []
      const advancedSpecifiers: string[] = []
      const themeSpecifiers: string[] = []
      const pluginSpecifiers: string[] = []

      for (const specifier of specifiers) {
        const importedName = extractImportedName(specifier)
        if (importedName && THEME_SYMBOLS.has(importedName)) {
          themeSpecifiers.push(specifier)
        } else if (importedName && PLUGIN_SYMBOLS.has(importedName)) {
          pluginSpecifiers.push(specifier)
        } else if (importedName && ADVANCED_SYMBOLS.has(importedName)) {
          advancedSpecifiers.push(specifier)
        } else {
          stableSpecifiers.push(specifier)
        }
      }

      if (advancedSpecifiers.length === 0 && themeSpecifiers.length === 0 && pluginSpecifiers.length === 0) {
        return statement
      }

      appliedTransforms.push("root-import-tier-split")
      const lines = [
        buildImportLine(stableSpecifiers, "@affino/datagrid-core"),
        buildImportLine(advancedSpecifiers, "@affino/datagrid-core/advanced"),
        buildImportLine(themeSpecifiers, "@affino/datagrid-theme"),
        buildImportLine(pluginSpecifiers, "@affino/datagrid-plugins"),
      ].filter((line): line is string => Boolean(line))

      return lines.join("\n")
    },
  )
}

export function transformDataGridPublicProtocolSource(source: string): DataGridCodemodResult {
  const appliedTransforms: string[] = []
  let code = source

  code = applyReplace(
    code,
    /from\s+["']@affino\/datagrid-core\/src\/public["']/g,
    'from "@affino/datagrid-core"',
    "core-root-entrypoint",
    appliedTransforms,
  )
  code = applyReplace(
    code,
    /from\s+["']@affino\/datagrid-core\/theme(?:\/index)?["']/g,
    'from "@affino/datagrid-theme"',
    "theme-entrypoint",
    appliedTransforms,
  )
  code = applyReplace(
    code,
    /from\s+["']@affino\/datagrid-core\/plugins(?:\/index)?["']/g,
    'from "@affino/datagrid-plugins"',
    "plugins-entrypoint",
    appliedTransforms,
  )
  code = applyReplace(
    code,
    /from\s+["']@affino\/datagrid-vue\/src\/public["']/g,
    'from "@affino/datagrid-vue"',
    "vue-root-entrypoint",
    appliedTransforms,
  )
  code = applyReplace(
    code,
    /from\s+["']@affino\/datagrid-core\/viewport\/dataGridViewportController["']/g,
    'from "@affino/datagrid-core/advanced"',
    "viewport-deep-import",
    appliedTransforms,
  )
  if (/\bcreateTableViewportController\b/.test(code)) {
    code = code.replace(/\bcreateTableViewportController\b/g, "createDataGridViewportController")
    appliedTransforms.push("viewport-factory-rename")
  } else if (/\bcreateDataGridViewportController\b/.test(code)) {
    appliedTransforms.push("viewport-factory-rename")
  }
  code = applyReplace(
    code,
    /\bserverIntegration\s*:/g,
    "/* TODO(datagrid-codemod): migrate to rowModel boundary */ serverIntegration:",
    "server-integration-todo",
    appliedTransforms,
  )
  code = rewriteRootImportsToTieredEntrypoints(code, appliedTransforms)

  return {
    code,
    changed: appliedTransforms.length > 0,
    appliedTransforms,
  }
}
