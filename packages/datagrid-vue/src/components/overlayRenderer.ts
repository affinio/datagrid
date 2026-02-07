export interface OverlayRectLike {
  id: string
  left: number
  top: number
  width: number
  height: number
  active?: boolean
  pin?: "left" | "none" | "right"
}

export interface OverlayTransformLike {
  pinnedLeftTranslateX: number
  pinnedRightTranslateX: number
}

export interface OverlayNodeCache {
  nodesByKey: Map<string, HTMLDivElement>
  pool: HTMLDivElement[]
}

export interface OverlayRenderMetrics {
  created: number
  reused: number
  released: number
  moved: number
  patched: number
  rendered: number
}

export interface RenderOverlayRectGroupInput {
  target: HTMLDivElement | null
  rects: readonly OverlayRectLike[] | undefined
  transform: OverlayTransformLike | null
  cache: OverlayNodeCache
}

const ACTIVE_CLASS = "ui-table__overlay-selection-range--active"
const BASE_CLASS = "ui-table__overlay-rect"
const EMPTY_SIGNATURE = "0:0"

const HASH_OFFSET = 2166136261
const HASH_PRIME = 16777619

function normalizeFinite(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function normalizePixel(value: number | undefined): number {
  return Math.round(normalizeFinite(value) * 1000) / 1000
}

function hashMix(hash: number, value: number): number {
  return Math.imul(hash ^ value, HASH_PRIME) >>> 0
}

function hashString(hash: number, value: string): number {
  let next = hash
  for (let index = 0; index < value.length; index += 1) {
    next = hashMix(next, value.charCodeAt(index))
  }
  return next
}

function hashRect(hash: number, rect: OverlayRectLike): number {
  let next = hashString(hash, rect.id ?? "")
  next = hashMix(next, normalizePixel(rect.left))
  next = hashMix(next, normalizePixel(rect.top))
  next = hashMix(next, normalizePixel(rect.width))
  next = hashMix(next, normalizePixel(rect.height))
  next = hashMix(next, rect.active ? 1 : 0)
  next = hashString(next, rect.pin ?? "none")
  return next
}

function resolveRectKey(rect: OverlayRectLike, index: number, keyUsage: Map<string, number>): string {
  const base = rect.id || `overlay-rect-${index}`
  const seen = keyUsage.get(base) ?? 0
  keyUsage.set(base, seen + 1)
  return seen === 0 ? base : `${base}#${seen}`
}

function setStyleIfChanged(style: CSSStyleDeclaration, key: "transform" | "width" | "height", value: string): void {
  if (style[key] !== value) {
    style[key] = value
  }
}

function resetRectNode(node: HTMLDivElement): void {
  node.className = BASE_CLASS
  node.style.transform = ""
  node.style.width = ""
  node.style.height = ""
}

function resolveRectTranslateX(rect: OverlayRectLike, transform: OverlayTransformLike | null): number {
  const base = normalizeFinite(rect.left)
  if (!transform) {
    return base
  }
  if (rect.pin === "left") {
    return base + normalizeFinite(transform.pinnedLeftTranslateX)
  }
  if (rect.pin === "right") {
    return base + normalizeFinite(transform.pinnedRightTranslateX)
  }
  return base
}

function patchRectNode(node: HTMLDivElement, rect: OverlayRectLike, transform: OverlayTransformLike | null): void {
  const x = resolveRectTranslateX(rect, transform)
  const y = normalizeFinite(rect.top)
  const width = Math.max(0, normalizeFinite(rect.width))
  const height = Math.max(0, normalizeFinite(rect.height))
  const style = node.style

  setStyleIfChanged(style, "transform", `translate3d(${x}px, ${y}px, 0)`)
  setStyleIfChanged(style, "width", `${width}px`)
  setStyleIfChanged(style, "height", `${height}px`)
  node.classList.toggle(ACTIVE_CLASS, Boolean(rect.active))
}

function recycleNode(cache: OverlayNodeCache, node: HTMLDivElement): void {
  resetRectNode(node)
  cache.pool.push(node)
}

export function createOverlayNodeCache(): OverlayNodeCache {
  return {
    nodesByKey: new Map<string, HTMLDivElement>(),
    pool: [],
  }
}

export function computeRectGroupSignature(rects: readonly OverlayRectLike[] | undefined): string {
  if (!rects || rects.length === 0) {
    return EMPTY_SIGNATURE
  }
  let hash = HASH_OFFSET
  for (let index = 0; index < rects.length; index += 1) {
    hash = hashRect(hash, rects[index]!)
  }
  return `${rects.length}:${hash >>> 0}`
}

export function computeCursorSignature(cursor: OverlayRectLike | null | undefined): string {
  if (!cursor) {
    return EMPTY_SIGNATURE
  }
  const hash = hashRect(HASH_OFFSET, cursor)
  return `1:${hash >>> 0}`
}

export function renderOverlayRectGroup(input: RenderOverlayRectGroupInput): OverlayRenderMetrics {
  const { target, rects, transform, cache } = input
  const metrics: OverlayRenderMetrics = {
    created: 0,
    reused: 0,
    released: 0,
    moved: 0,
    patched: 0,
    rendered: 0,
  }

  if (!target) {
    return metrics
  }

  const nextRects = rects ?? []
  const nextNodesByKey = new Map<string, HTMLDivElement>()
  const keyUsage = new Map<string, number>()
  const orderedKeys: string[] = []

  for (let index = 0; index < nextRects.length; index += 1) {
    const rect = nextRects[index]!
    const key = resolveRectKey(rect, index, keyUsage)
    orderedKeys.push(key)
    const existing = cache.nodesByKey.get(key)
    const node = existing ?? cache.pool.pop() ?? document.createElement("div")

    if (existing) {
      metrics.reused += 1
    } else {
      metrics.created += 1
      resetRectNode(node)
    }

    patchRectNode(node, rect, transform)
    metrics.patched += 1
    metrics.rendered += 1

    nextNodesByKey.set(key, node)
  }

  for (const [key, node] of cache.nodesByKey) {
    if (nextNodesByKey.has(key)) {
      continue
    }
    if (node.parentElement === target) {
      target.removeChild(node)
    }
    recycleNode(cache, node)
    metrics.released += 1
  }

  let anchor = target.firstChild
  for (let index = 0; index < orderedKeys.length; index += 1) {
    const key = orderedKeys[index]!
    const node = nextNodesByKey.get(key)
    if (!node) {
      continue
    }
    if (node === anchor) {
      anchor = anchor?.nextSibling ?? null
      continue
    }
    target.insertBefore(node, anchor)
    metrics.moved += 1
  }

  while (anchor) {
    const nextSibling = anchor.nextSibling
    const staleNode = anchor as HTMLDivElement
    target.removeChild(staleNode)
    recycleNode(cache, staleNode)
    metrics.released += 1
    anchor = nextSibling
  }

  cache.nodesByKey = nextNodesByKey
  return metrics
}
