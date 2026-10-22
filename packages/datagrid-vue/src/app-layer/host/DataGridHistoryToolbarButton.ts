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
    presentation: {
      type: String as PropType<"label" | "icon">,
      default: "label",
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
    const icon = (): VNode => h("svg", {
      viewBox: "0 0 16 16",
      width: 16,
      height: 16,
      fill: "none",
      "aria-hidden": "true",
      focusable: "false",
    }, [h("path", {
      d: props.action === "undo"
        ? "M6.25 4 2.5 7.25 6.25 10.5V8.25h3.1a2.65 2.65 0 1 1 0 5.3H7.5V15h1.85a4.1 4.1 0 1 0 0-8.2h-3.1V4Z"
        : "M9.75 4 13.5 7.25 9.75 10.5V8.25h-3.1a2.65 2.65 0 1 0 0 5.3H8.5V15H6.65a4.1 4.1 0 1 1 0-8.2h3.1V4Z",
      fill: "currentColor",
    })])
    return (): VNode => h("button", {
      type: "button",
      class: [
        "datagrid-app-toolbar__button",
        props.presentation === "icon" ? "datagrid-app-toolbar__button--icon-only" : null,
      ],
      "data-datagrid-toolbar-action": props.action,
      "aria-label": props.label,
      title: props.presentation === "icon" ? props.label : undefined,
      disabled: props.disabled,
      onClick: () => {
        void props.onTrigger()
      },
    }, props.presentation === "icon" ? icon() : props.label)
  },
})
