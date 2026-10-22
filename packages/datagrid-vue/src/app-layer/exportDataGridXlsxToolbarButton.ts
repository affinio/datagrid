import { defineComponent, h, ref, type PropType, type VNode } from "vue"
import type {
  DataGridXlsxExportProgress,
  DataGridXlsxExportResult,
} from "./exportDataGridXlsx"

type RunExport = (
  signal: AbortSignal,
  reportProgress: (progress: DataGridXlsxExportProgress) => void,
) => Promise<DataGridXlsxExportResult>

function downloadWorkbook(result: Extract<DataGridXlsxExportResult, { status: "success" }>): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return
  const bytes = result.bytes.slice().buffer as ArrayBuffer
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = result.fileName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default defineComponent({
  name: "DataGridXlsxExportToolbarButton",
  props: {
    label: { type: String, default: "Export XLSX" },
    onExport: { type: Function as PropType<RunExport>, required: true },
  },
  setup(props) {
    const controller = ref<AbortController | null>(null)
    const busy = ref(false)
    const progressText = ref("")
    const statusText = ref("")

    const trigger = async (): Promise<void> => {
      if (controller.value) {
        controller.value.abort()
        return
      }
      const activeController = new AbortController()
      controller.value = activeController
      busy.value = true
      statusText.value = ""
      progressText.value = "Preparing export…"
      try {
        const result = await props.onExport(activeController.signal, progress => {
          progressText.value = progress.phase === "writing" ? "Writing workbook…" : `Preparing ${progress.completedRows}/${progress.totalRows} rows…`
        })
        if (result.status === "success") {
          downloadWorkbook(result)
          statusText.value = result.warnings.length > 0 ? result.warnings.join(" ") : "Export ready."
          return
        }
        if (result.status === "unsupported" || result.status === "error") statusText.value = result.message
        else statusText.value = "Export cancelled."
      } catch (error) {
        statusText.value = error instanceof Error ? error.message : String(error)
      } finally {
        if (controller.value === activeController) controller.value = null
        busy.value = false
        progressText.value = ""
      }
    }

    return (): VNode => h("div", { class: "datagrid-app-toolbar__export" }, [
      h("button", {
        type: "button",
        class: "datagrid-app-toolbar__button",
        "data-datagrid-toolbar-action": "export-xlsx",
        "aria-busy": busy.value ? "true" : "false",
        "aria-label": busy.value ? "Cancel XLSX export" : props.label,
        title: statusText.value || undefined,
        onClick: trigger,
      }, busy.value ? "Cancel export" : props.label),
      busy.value ? h("span", { class: "datagrid-app-toolbar__export-status", role: "status" }, progressText.value) : null,
      statusText.value ? h("span", { class: "datagrid-app-toolbar__export-status", role: "status" }, statusText.value) : null,
    ])
  },
})
