/** Keeps retained nodes attached; only inserts, removes or moves changed children. */
export function reconcileChildren(parent: Element, children: readonly Node[]): void {
  const retained = new Set(children)
  for (const child of Array.from(parent.childNodes)) {
    if (!retained.has(child)) parent.removeChild(child)
  }
  let cursor = parent.firstChild
  for (const child of children) {
    if (child === cursor) cursor = cursor.nextSibling
    else parent.insertBefore(child, cursor)
  }
}
