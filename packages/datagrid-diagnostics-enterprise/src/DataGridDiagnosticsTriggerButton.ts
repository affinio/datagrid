import { defineComponent, h, type PropType, type VNode } from "vue"

export default defineComponent({
  name: "DataGridDiagnosticsTriggerButton",
  props: {
    buttonLabel: {
      type: String,
      default: "Diagnostics",
    },
    active: {
      type: Boolean,
      default: false,
    },
    onToggle: {
      type: Function as PropType<(() => void) | undefined>,
      default: undefined,
    },
  },
  setup(props): () => VNode {
    return () => h("button", {
      type: "button",
      class: [
        "datagrid-app-toolbar__button",
        props.active ? "datagrid-app-toolbar__button--active" : null,
      ],
      "data-datagrid-enterprise-diagnostics-trigger": "",
      onClick: () => props.onToggle?.(),
    }, props.buttonLabel)
  },
})
