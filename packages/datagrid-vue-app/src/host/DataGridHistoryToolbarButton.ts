import { defineComponent, h, type PropType, type VNode } from "vue"

export default defineComponent({
  name: "DataGridHistoryToolbarButton",
  props: {
    action: {
      type: String as PropType<"undo" | "redo">,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    onTrigger: {
      type: Function as PropType<() => void | Promise<void>>,
      required: true,
    },
  },
  setup(props) {
    return (): VNode => h("button", {
      type: "button",
      class: "datagrid-app-toolbar__button",
      "data-datagrid-toolbar-action": props.action,
      disabled: props.disabled,
      onClick: () => {
        void props.onTrigger()
      },
    }, props.label)
  },
})