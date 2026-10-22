import { computed, defineComponent, h, type Component, type PropType, type VNode } from "vue"
import { resolveDataGridChrome, type DataGridChromeProp } from "../config/dataGridChrome"
import { resolveDataGridThemeStyleVars, type DataGridThemeProp } from "../theme/dataGridTheme"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"
import {
  resolveDataGridToolbarItemPlacement,
  type DataGridToolbarLayoutProp,
} from "../config/dataGridToolbarLayout"

function resolveToolbarChromeStyle(chrome: DataGridChromeProp): Record<string, string> {
  const resolved = resolveDataGridChrome(chrome)
  const compact = resolved.density === "compact"
  return {
    "--datagrid-app-toolbar-gap": `${resolved.toolbarGap}px`,
    "--datagrid-app-toolbar-group-gap": compact ? "6px" : "8px",
    "--datagrid-app-toolbar-button-gap": compact ? "6px" : "8px",
    "--datagrid-app-toolbar-button-height": compact ? "28px" : "32px",
    "--datagrid-app-toolbar-button-padding-inline": compact ? "10px" : "12px",
    "--datagrid-app-toolbar-button-font-size": compact ? "11px" : "12px",
    "--datagrid-app-toolbar-surface-padding-block": compact ? "8px" : "10px",
    "--datagrid-app-toolbar-surface-padding-inline": compact ? "10px" : "12px",
  }
}

export interface DataGridAppToolbarModule {
  key: string
  component: Component
  props?: Record<string, unknown>
}

export interface DataGridAppInspectorPanel {
  component: Component
  props?: Record<string, unknown>
}

export default defineComponent({
  name: "DataGridModuleHost",
  props: {
    modules: {
      type: Array as PropType<readonly DataGridAppToolbarModule[]>,
      default: () => [],
    },
    variant: {
      type: String as PropType<"standalone" | "integrated">,
      default: "standalone",
    },
    theme: {
      type: [String, Object] as PropType<DataGridThemeProp>,
      default: "default",
    },
    chrome: {
      type: [String, Object] as PropType<DataGridChromeProp>,
      default: "comfortable",
    },
    toolbarLayout: {
      type: Object as PropType<DataGridToolbarLayoutProp>,
      default: undefined,
    },
  },
  setup(props) {
    ensureDataGridAppStyles()
    const themeStyle = computed(() => resolveDataGridThemeStyleVars(props.theme))
    const chromeStyle = computed(() => resolveToolbarChromeStyle(props.chrome))
    return (): VNode | null => {
      if (props.modules.length === 0) {
        return null
      }
      const rows: Array<Record<"start" | "center" | "end", VNode[]>> = []
      const hasGroupByLevels = props.modules.some(module => module.key === "group-by-levels")
      for (const module of props.modules) {
        const defaultRow = hasGroupByLevels && module.key !== "group-by-levels" ? 1 : 0
        const placement = resolveDataGridToolbarItemPlacement(module.key, props.toolbarLayout, { row: defaultRow })
        for (let index = rows.length; index <= placement.row; index += 1) {
          rows[index] = { start: [], center: [], end: [] }
        }
        const row = rows[placement.row] ??= { start: [], center: [], end: [] }
        row[placement.align].push(h(module.component, {
          key: module.key,
          ...(module.props ?? {}),
        }))
      }
      return h("div", {
        class: [
          "datagrid-app-toolbar",
          props.variant === "integrated" ? "datagrid-app-toolbar--integrated" : null,
        ],
        style: { ...themeStyle.value, ...chromeStyle.value },
      }, rows.map(row => h("div", { class: "datagrid-app-toolbar__row" }, [
        h("div", { class: "datagrid-app-toolbar__group datagrid-app-toolbar__group--start" }, row.start),
        h("div", { class: "datagrid-app-toolbar__group datagrid-app-toolbar__group--center" }, row.center),
        h("div", { class: "datagrid-app-toolbar__group datagrid-app-toolbar__group--end" }, row.end),
      ])))
    }
  },
})
