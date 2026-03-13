export interface UseDataGridInlineEditorFocusOptions {
  resolveViewportElement: () => HTMLElement | null
  beforeFocus?: () => void | Promise<void>
}

export interface UseDataGridInlineEditorFocusResult {
  focusInlineEditorElement: (
    rowId: string,
    columnKey: string,
    mode: string,
    openPicker: boolean,
  ) => Promise<void>
}

const FOCUSABLE_SELECTOR = "input,textarea,select,button,[tabindex]"

export function useDataGridInlineEditorFocus(
  options: UseDataGridInlineEditorFocusOptions,
): UseDataGridInlineEditorFocusResult {
  async function focusInlineEditorElement(
    rowId: string,
    columnKey: string,
    mode: string,
    openPicker: boolean,
  ): Promise<void> {
    await options.beforeFocus?.()
    const viewport = options.resolveViewportElement()
    if (!viewport) {
      return
    }
    const selector = `[data-inline-editor-row-id="${rowId}"][data-inline-editor-column-key="${columnKey}"]`
    const editorHost = viewport.querySelector(selector) as HTMLElement | null
    if (!editorHost) {
      return
    }
    const editor = editorHost.matches(FOCUSABLE_SELECTOR)
      ? editorHost
      : (editorHost.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null)
    if (!editor) {
      return
    }
    editor.focus()
    if (editor instanceof HTMLInputElement) {
      editor.select()
      return
    }
    if (mode === "select" && openPicker) {
      try {
        editor.click()
      } catch {
        // Ignore click-open failures for synthetic editors.
      }
    }
  }

  return {
    focusInlineEditorElement,
  }
}

