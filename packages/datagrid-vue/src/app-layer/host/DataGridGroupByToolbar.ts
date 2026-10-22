import { defineComponent, h, type PropType } from "vue"

export interface DataGridGroupByToolbarLevel {
  key: string
  label: string
}

export default defineComponent({
  name: "DataGridGroupByToolbar",
  props: {
    levels: {
      type: Array as PropType<readonly DataGridGroupByToolbarLevel[]>,
      required: true,
    },
    onRemove: {
      type: Function as PropType<(key: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => h("div", {
      class: "datagrid-grouping-toolbar",
      role: "group",
      "aria-label": "Grouped columns",
    }, [
      h("span", { class: "datagrid-grouping-toolbar__label" }, "Grouped by"),
      ...props.levels.map((level, index) => h("span", {
        key: level.key,
        class: "datagrid-grouping-toolbar__level",
      }, [
        h("span", { class: "datagrid-grouping-toolbar__order", "aria-hidden": "true" }, String(index + 1)),
        h("span", { class: "datagrid-grouping-toolbar__name" }, level.label),
        h("button", {
          type: "button",
          class: "datagrid-grouping-toolbar__remove",
          "aria-label": `Remove grouping by ${level.label}`,
          title: `Remove ${level.label} grouping`,
          onClick: () => props.onRemove(level.key),
        }, "×"),
      ])),
    ])
  },
})
