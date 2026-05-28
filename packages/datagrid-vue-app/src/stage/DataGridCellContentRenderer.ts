import { Fragment, cloneVNode, defineComponent, h, isVNode, type PropType, type VNode, type VNodeChild } from "vue"

const STATEFUL_NATIVE_CONTENT_TAGS = new Set([
  "a",
  "button",
  "details",
  "input",
  "option",
  "select",
  "summary",
  "textarea",
])

function shouldKeyNativeContent(node: VNode): boolean {
  return typeof node.type === "string" && STATEFUL_NATIVE_CONTENT_TAGS.has(node.type)
}

function shouldKeyRenderedContent(content: VNodeChild): content is VNode {
  if (!isVNode(content)) {
    return false
  }
  if (typeof content.type === "string") {
    return shouldKeyNativeContent(content)
  }
  return true
}

function resolveRenderedContent(content: VNodeChild, contentKey?: string): VNodeChild {
  if (!contentKey) {
    return content
  }
  if (Array.isArray(content)) {
    return h(Fragment, { key: contentKey }, content)
  }
  if (!shouldKeyRenderedContent(content)) {
    return content
  }
  return cloneVNode(content, { key: contentKey })
}

export default defineComponent({
  name: "DataGridCellContentRenderer",
  props: {
    content: {
      type: null as unknown as PropType<VNodeChild>,
      default: null,
    },
    contentKey: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    return () => resolveRenderedContent(props.content, props.contentKey) as VNodeChild
  },
})
