const Module = require("module")
const originalLoad = Module._load

Module._load = function patched(request, parent, isMain) {
  if (request && request.includes("@vitest/expect")) {
    console.error(`[trace-vitest] loading ${request} from ${parent?.filename}`)
  }
  return originalLoad(request, parent, isMain)
}
