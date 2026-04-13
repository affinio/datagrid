import type { Component } from "vue"
import DataGridSpreadsheetWorkbookAppComponent from "./DataGridSpreadsheetWorkbookApp.vue"
import DataGridSpreadsheetFormulaEditorComponent from "./DataGridSpreadsheetFormulaEditor.vue"

export const DataGridSpreadsheetWorkbookApp: Component = DataGridSpreadsheetWorkbookAppComponent
export const DataGridSpreadsheetFormulaEditor: Component = DataGridSpreadsheetFormulaEditorComponent

export * from "./useDataGridSpreadsheetWorkbookHistory"
export { default } from "./DataGridSpreadsheetWorkbookApp.vue"
