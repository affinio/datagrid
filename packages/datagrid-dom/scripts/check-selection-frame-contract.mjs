import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const stylesheet = await readFile(resolve(packageRoot, "src/styles/selection.css"), "utf8")
const overlayRule = stylesheet.match(/\.affino-grid-dom__cell--range-frame::after\s*\{([^}]+)\}/s)?.[1] ?? ""
const anchorRule = stylesheet.match(/\.affino-grid-dom__cell--range-anchor\s*\{([^}]+)\}/s)?.[1] ?? ""

if (!/position:\s*absolute/.test(overlayRule) || !/inset:\s*0/.test(overlayRule) || !/pointer-events:\s*none/.test(overlayRule)) {
  throw new Error("Selection frame must render as a positioned, non-interactive overlay.")
}

if (!/\.affino-grid-dom__cell--range-frame:not\(\.affino-grid-dom__cell--pinned\)\s*\{[^}]*position:\s*relative/s.test(stylesheet)) {
  throw new Error("Selection frames must not override sticky positioning on pinned cells.")
}

if (!/\.affino-grid-dom__cell--range-frame\s*\{[^}]*--affino-grid-dom-range-border:\s*var\(/s.test(stylesheet)) {
  throw new Error("Pinned and unpinned selection frame overlays must share a resolved border color.")
}

if (!/background-color:\s*var\(--datagrid-selection-range-bg/.test(anchorRule)) {
  throw new Error("Selection anchors must use the same highlight as the rest of the selected range.")
}

for (const side of ["top", "right", "bottom", "left"]) {
  const edgeRule = new RegExp(`\\.affino-grid-dom__cell--range-${side}::after\\s*\\{[^}]*border-${side}-width:\\s*2px`, "s")
  const layoutBorderRule = new RegExp(`\\.affino-grid-dom__cell--range-${side}\\s*\\{[^}]*border-${side}(?:-width)?:`, "s")
  if (!edgeRule.test(stylesheet) || layoutBorderRule.test(stylesheet)) {
    throw new Error(`Selection ${side} edge must be drawn by the overlay without changing cell geometry.`)
  }
}

console.log("DOM adapter range frame is an overlay and does not change cell dimensions.")
