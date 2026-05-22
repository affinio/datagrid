import { defineComponent, h, type PropType, type VNode } from "vue"

export default defineComponent({
  name: "DataGridQuickFilterInput",
  props: {
    value: {
      type: String,
      default: "",
    },
    placeholder: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    dirty: {
      type: Boolean,
      default: false,
    },
    manual: {
      type: Boolean,
      default: false,
    },
    onUpdateValue: {
      type: Function as PropType<(value: string) => void>,
      required: true,
    },
    onApply: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
    onClear: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return (): VNode => h("label", {
      class: [
        "datagrid-app-quick-filter",
        props.active ? "datagrid-app-quick-filter--active" : null,
      ],
    }, [
      h("span", {
        class: "datagrid-app-quick-filter__label",
      }, "Quick filter"),
      h("input", {
        class: "datagrid-app-quick-filter__input",
        type: "text",
        value: props.value,
        placeholder: props.placeholder,
        "aria-label": "Quick filter",
        "data-datagrid-quick-filter-input": "true",
        onInput: (event: Event) => {
          props.onUpdateValue((event.target as HTMLInputElement | null)?.value ?? "")
        },
        onKeydown: (event: KeyboardEvent) => {
          if (event.key !== "Enter" || !props.manual) {
            return
          }
          event.preventDefault()
          props.onApply?.()
        },
      }),
      props.manual
        ? h("button", {
            type: "button",
            class: "datagrid-app-quick-filter__apply",
            disabled: !props.dirty,
            "aria-label": "Apply quick filter",
            "data-datagrid-quick-filter-apply": "true",
            onClick: () => props.onApply?.(),
          }, "Apply")
        : null,
      h("button", {
        type: "button",
        class: "datagrid-app-quick-filter__clear",
        disabled: !props.active,
        "aria-label": "Clear quick filter",
        "data-datagrid-quick-filter-clear": "true",
        onClick: () => props.onClear(),
      }, "Clear"),
    ])
  },
})
