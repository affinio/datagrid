import { defineComponent, type PropType, type VNodeChild } from "vue"

export default defineComponent({
  name: "DataGridCellContentRenderer",
  props: {
    content: {
      type: null as unknown as PropType<VNodeChild>,
      default: null,
    },
  },
  setup(props) {
    return () => props.content as VNodeChild
  },
})
