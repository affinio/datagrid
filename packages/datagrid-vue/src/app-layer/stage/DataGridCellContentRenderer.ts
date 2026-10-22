import { Fragment, cloneVNode, h, isVNode, type FunctionalComponent, type PropType, type VNode, type VNodeChild } from "vue"

const PATCHABLE_NATIVE_TEXT_CONTENT_TAGS = new Set(["span"])
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

function isPrimitiveNativeTextContent(content: VNodeChild): content is VNode {
  if (!isVNode(content) || typeof content.type !== "string") {
    return false
  }
  if (!PATCHABLE_NATIVE_TEXT_CONTENT_TAGS.has(content.type)) {
    return false
  }
  if (typeof content.children !== "string" && typeof content.children !== "number") {
    return false
  }
  const props = content.props as Record<string, unknown> | null
  return !props || (props.innerHTML == null && props.textContent == null)
}

function resolvePatchableNativeTextContent(content: VNodeChild): VNodeChild {
  if (!isPrimitiveNativeTextContent(content)) {
    return content
  }
  const normalizedContent = h(content.type as string, content.props, [String(content.children)])
  if (content.dirs) {
    normalizedContent.dirs = content.dirs
  }
  if (content.transition) {
    normalizedContent.transition = content.transition
  }
  if (content.scopeId) {
    normalizedContent.scopeId = content.scopeId
  }
  if (content.appContext) {
    normalizedContent.appContext = content.appContext
  }
  return normalizedContent
}

function resolveRenderedContent(content: VNodeChild, contentKey?: string): VNodeChild {
  const resolvedContent = resolvePatchableNativeTextContent(content)
  if (!contentKey) {
    return resolvedContent
  }
  if (Array.isArray(resolvedContent)) {
    return h(Fragment, { key: contentKey }, resolvedContent)
  }
  if (!shouldKeyRenderedContent(resolvedContent)) {
    return resolvedContent
  }
  return cloneVNode(resolvedContent, { key: contentKey })
}

interface DataGridCellContentRendererProps {
  content?: VNodeChild
  contentKey?: string
}

const DataGridCellContentRenderer: FunctionalComponent<DataGridCellContentRendererProps> = props => (
  resolveRenderedContent(props.content ?? null, props.contentKey) as VNodeChild
)

DataGridCellContentRenderer.displayName = "DataGridCellContentRenderer"
DataGridCellContentRenderer.props = {
  content: {
    type: null as unknown as PropType<VNodeChild>,
    default: null,
  },
  contentKey: {
    type: String,
    default: undefined,
  },
}

export default DataGridCellContentRenderer
