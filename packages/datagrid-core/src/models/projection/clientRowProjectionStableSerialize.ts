export function stableSerializeUnknown(value: unknown, active = new WeakSet<object>()): string {
  if (value == null) {
    return JSON.stringify(value)
  }
  if (typeof value === "bigint") {
    return JSON.stringify(`${value}n`)
  }
  if (typeof value === "function") {
    return JSON.stringify(`[Function:${value.name || "anonymous"}]`)
  }
  if (typeof value === "symbol") {
    return JSON.stringify(String(value))
  }
  if (typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (value instanceof RegExp) {
    return JSON.stringify(String(value))
  }
  if (active.has(value)) {
    return JSON.stringify("[Circular]")
  }
  active.add(value)
  try {
    if (Array.isArray(value)) {
      return `[${value.map(entry => stableSerializeUnknown(entry, active)).join(",")}]`
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested, active)}`)
    return `{${entries.join(",")}}`
  } finally {
    active.delete(value)
  }
}

