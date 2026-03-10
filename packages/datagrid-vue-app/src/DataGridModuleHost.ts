import { defineComponent, h, type Component, type PropType, type VNode } from "vue"

export interface DataGridAppToolbarModule {
  key: string
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
  },
  setup(props) {
    return (): VNode | null => {
      if (props.modules.length === 0) {
        return null
      }
      return h("div", { class: "datagrid-app-toolbar" }, [
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
