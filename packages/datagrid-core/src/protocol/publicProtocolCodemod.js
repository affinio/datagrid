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
]);
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
]);
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
]);
function applyReplace(source, pattern, replacement, tag, appliedTransforms) {
    const next = source.replace(pattern, replacement);
    if (next !== source) {
        appliedTransforms.push(tag);
    }
    return next;
}
function normalizeSpecifiers(raw) {
    return raw
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);
}
function extractImportedName(specifier) {
    const withoutType = specifier.replace(/^type\s+/, "").trim();
    const parts = withoutType.split(/\s+as\s+/);
    const imported = (parts[0] ?? "").trim();
    return imported.length > 0 ? imported : null;
}
function buildImportLine(specifiers, source) {
    if (specifiers.length === 0) {
        return null;
    }
    return `import { ${specifiers.join(", ")} } from "${source}"`;
}
function rewriteRootImportsToTieredEntrypoints(source, appliedTransforms) {
    let cursor = 0;
    let output = "";
    while (cursor < source.length) {
        const importStart = source.indexOf("import", cursor);
        if (importStart === -1) {
            output += source.slice(cursor);
            break;
        }
        if (!isImportKeywordAt(source, importStart)) {
            output += source.slice(cursor, importStart + 6);
            cursor = importStart + 6;
            continue;
        }
        output += source.slice(cursor, importStart);
        const statementEnd = findImportStatementEnd(source, importStart);
        const statement = source.slice(importStart, statementEnd);
        const rewritten = rewriteCoreImportStatement(statement, appliedTransforms);
        output += rewritten ?? statement;
        cursor = statementEnd;
    }
    return output;
}
function isImportKeywordAt(source, index) {
    const before = index === 0 ? "" : source[index - 1] ?? "";
    const after = source[index + 6] ?? "";
    const isWordChar = (char) => /[A-Za-z0-9_$]/.test(char);
    return !isWordChar(before) && !isWordChar(after);
}
function findImportStatementEnd(source, importStart) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let escaping = false;
    let braceDepth = 0;
    for (let index = importStart; index < source.length; index += 1) {
        const char = source[index] ?? "";
        if (escaping) {
            escaping = false;
            continue;
        }
        if (char === "\\") {
            escaping = true;
            continue;
        }
        if (inSingleQuote) {
            if (char === "'") {
                inSingleQuote = false;
            }
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"') {
                inDoubleQuote = false;
            }
            continue;
        }
        if (inTemplate) {
            if (char === "`") {
                inTemplate = false;
            }
            continue;
        }
        if (char === "'") {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }
        if (char === "`") {
            inTemplate = true;
            continue;
        }
        if (char === "{") {
            braceDepth += 1;
            continue;
        }
        if (char === "}") {
            braceDepth = Math.max(0, braceDepth - 1);
            continue;
        }
        if (char === ";" && braceDepth === 0) {
            return index + 1;
        }
        if ((char === "\n" || char === "\r") && braceDepth === 0) {
            return index;
        }
    }
    return source.length;
}
function rewriteCoreImportStatement(statement, appliedTransforms) {
    const trimmed = statement.trim();
    if (!trimmed.startsWith("import") || !trimmed.includes("@affino/datagrid-core")) {
        return null;
    }
    const specifierOpen = trimmed.indexOf("{");
    const specifierClose = trimmed.lastIndexOf("}");
    if (specifierOpen === -1 || specifierClose === -1 || specifierClose <= specifierOpen) {
        return null;
    }
    const fromIndex = trimmed.indexOf("from", specifierClose);
    if (fromIndex === -1) {
        return null;
    }
    const importSource = trimmed.slice(fromIndex + 4).trim().replace(/;$/, "");
    if (importSource !== '"@affino/datagrid-core"' && importSource !== "'@affino/datagrid-core'") {
        return null;
    }
    const rawSpecifiers = trimmed.slice(specifierOpen + 1, specifierClose);
    const specifiers = normalizeSpecifiers(rawSpecifiers);
    const stableSpecifiers = [];
    const advancedSpecifiers = [];
    const themeSpecifiers = [];
    const pluginSpecifiers = [];
    for (const specifier of specifiers) {
        const importedName = extractImportedName(specifier);
        if (importedName && THEME_SYMBOLS.has(importedName)) {
            themeSpecifiers.push(specifier);
        }
        else if (importedName && PLUGIN_SYMBOLS.has(importedName)) {
            pluginSpecifiers.push(specifier);
        }
        else if (importedName && ADVANCED_SYMBOLS.has(importedName)) {
            advancedSpecifiers.push(specifier);
        }
        else {
            stableSpecifiers.push(specifier);
        }
    }
    if (advancedSpecifiers.length === 0 && themeSpecifiers.length === 0 && pluginSpecifiers.length === 0) {
        return null;
    }
    appliedTransforms.push("root-import-tier-split");
    const lines = [
        buildImportLine(stableSpecifiers, "@affino/datagrid-core"),
        buildImportLine(advancedSpecifiers, "@affino/datagrid-core/advanced"),
        buildImportLine(themeSpecifiers, "@affino/datagrid-theme"),
        buildImportLine(pluginSpecifiers, "@affino/datagrid-plugins"),
    ].filter((line) => Boolean(line));
    return lines.join("\n");
}
export function transformDataGridPublicProtocolSource(source) {
    const appliedTransforms = [];
    let code = source;
    code = applyReplace(code, /from\s+["']@affino\/datagrid-core\/src\/public["']/g, 'from "@affino/datagrid-core"', "core-root-entrypoint", appliedTransforms);
    code = applyReplace(code, /from\s+["']@affino\/datagrid-core\/theme(?:\/index)?["']/g, 'from "@affino/datagrid-theme"', "theme-entrypoint", appliedTransforms);
    code = applyReplace(code, /from\s+["']@affino\/datagrid-core\/plugins(?:\/index)?["']/g, 'from "@affino/datagrid-plugins"', "plugins-entrypoint", appliedTransforms);
    code = applyReplace(code, /from\s+["']@affino\/datagrid-vue\/src\/public["']/g, 'from "@affino/datagrid-vue"', "vue-root-entrypoint", appliedTransforms);
    code = applyReplace(code, /from\s+["']@affino\/datagrid-core\/viewport\/dataGridViewportController["']/g, 'from "@affino/datagrid-core/advanced"', "viewport-deep-import", appliedTransforms);
    if (/\bcreateTableViewportController\b/.test(code)) {
        code = code.replace(/\bcreateTableViewportController\b/g, "createDataGridViewportController");
        appliedTransforms.push("viewport-factory-rename");
    }
    else if (/\bcreateDataGridViewportController\b/.test(code)) {
        appliedTransforms.push("viewport-factory-rename");
    }
    code = applyReplace(code, /\bserverIntegration\s*:/g, "/* TODO(datagrid-codemod): migrate to rowModel boundary */ serverIntegration:", "server-integration-todo", appliedTransforms);
    code = rewriteRootImportsToTieredEntrypoints(code, appliedTransforms);
    return {
        code,
        changed: appliedTransforms.length > 0,
        appliedTransforms,
    };
}
