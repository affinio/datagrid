import { computed, defineComponent, h, type Component, type PropType, type VNode } from "vue"
import { resolveDataGridChrome, type DataGridChromeProp } from "../config/dataGridChrome"
import { resolveDataGridThemeStyleVars, type DataGridThemeProp } from "../theme/dataGridTheme"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"

function resolveToolbarChromeStyle(chrome: DataGridChromeProp): Record<string, string> {
  const compact = resolveDataGridChrome(chrome).density === "compact"
  return {
    "--datagrid-app-toolbar-gap": compact ? "10px" : "12px",
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
  },
  setup(props) {
    ensureDataGridAppStyles()
    const themeStyle = computed(() => resolveDataGridThemeStyleVars(props.theme))
    const chromeStyle = computed(() => resolveToolbarChromeStyle(props.chrome))
    return (): VNode | null => {
      if (props.modules.length === 0) {
        return null
      }
      return h("div", {
        class: [
          "datagrid-app-toolbar",
          props.variant === "integrated" ? "datagrid-app-toolbar--integrated" : null,
        ],
        style: { ...themeStyle.value, ...chromeStyle.value },
      }, [
        h("div", { class: "datagrid-app-toolbar__group" }, props.modules.map(module => (
          h(module.component, {
            key: module.key,
            ...(module.props ?? {}),
          })
        ))),
      ])
    }
  },
})
