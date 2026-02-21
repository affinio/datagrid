export function useDataGridInlineEditOrchestration(options) {
    let inlineEditor = null;
    const listeners = new Set();
    function setInlineEditor(next) {
        inlineEditor = next;
        listeners.forEach(listener => listener(next));
    }
    function subscribeInlineEditor(listener) {
        listeners.add(listener);
        listener(inlineEditor);
        return () => {
            listeners.delete(listener);
        };
    }
    function isEditingCell(rowId, columnKey) {
        return inlineEditor?.rowId === rowId && inlineEditor?.columnKey === columnKey;
    }
    function isSelectEditorCell(rowId, columnKey) {
        if (!isEditingCell(rowId, columnKey) || inlineEditor?.mode !== "select") {
            return false;
        }
        return options.isSelectColumn ? options.isSelectColumn(columnKey) : true;
    }
    function beginInlineEdit(row, columnKey, mode = "text", openPicker = false) {
        if (!options.isEditableColumn(columnKey)) {
            return false;
        }
        const rowId = options.resolveRowId(row);
        setInlineEditor({
            rowId,
            columnKey,
            draft: String(options.resolveCellValue(row, columnKey) ?? ""),
            mode,
        });
        if (options.setLastAction) {
            const rowLabel = options.resolveRowLabel?.(row);
            options.setLastAction(mode === "select"
                ? `Selecting ${columnKey}${rowLabel ? ` for ${rowLabel}` : ""}`
                : `Editing ${columnKey}${rowLabel ? ` for ${rowLabel}` : ""}`);
        }
        void options.focusInlineEditor?.(rowId, columnKey, mode, openPicker);
        return true;
    }
    function cancelInlineEdit() {
        if (!inlineEditor) {
            return;
        }
        setInlineEditor(null);
        options.setLastAction?.("Edit canceled");
    }
    function commitInlineEdit() {
        if (!inlineEditor) {
            return false;
        }
        const editor = inlineEditor;
        const beforeSnapshot = options.captureBeforeSnapshot?.();
        const nextDraft = editor.draft.trim();
        setInlineEditor(null);
        let updated = false;
        const nextRows = options.sourceRows().map(row => {
            if (options.resolveRowId(row) !== editor.rowId) {
                return row;
            }
            const nextRow = options.cloneRow(row);
            options.applyEditedValue(nextRow, editor.columnKey, nextDraft);
            options.finalizeEditedRow?.(nextRow, editor.columnKey, nextDraft);
            updated = true;
            return nextRow;
        });
        if (updated) {
            options.setSourceRows(nextRows);
            options.setLastAction?.(`Saved ${editor.columnKey}`);
            if (options.recordIntentTransaction && typeof beforeSnapshot !== "undefined") {
                const affectedRange = options.resolveAffectedRange
                    ? options.resolveAffectedRange({ rowId: editor.rowId, columnKey: editor.columnKey })
                    : null;
                void options.recordIntentTransaction({
                    intent: "edit",
                    label: `Edit ${editor.columnKey}`,
                    affectedRange,
                }, beforeSnapshot);
            }
            return true;
        }
        options.setLastAction?.("Edit target no longer available");
        return false;
    }
    function updateEditorDraft(value) {
        if (!inlineEditor) {
            return;
        }
        setInlineEditor({
            ...inlineEditor,
            draft: value,
        });
    }
    function onEditorInput(event) {
        updateEditorDraft(event.target.value);
    }
    function onEditorSelectChange(value) {
        updateEditorDraft(String(value));
        return commitInlineEdit();
    }
    return {
        getInlineEditor: () => inlineEditor,
        subscribeInlineEditor,
        isEditingCell,
        isSelectEditorCell,
        beginInlineEdit,
        cancelInlineEdit,
        commitInlineEdit,
        updateEditorDraft,
        onEditorInput,
        onEditorSelectChange,
    };
}
