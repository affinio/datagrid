export interface DataGridClipboardDriver {
  writeClipboardText?: (payload: string) => Promise<void>
  readClipboardText?: () => Promise<string>
}

function resolveNavigatorClipboard(): Clipboard | undefined {
  if (typeof navigator === "undefined") {
    return undefined
  }
  return navigator.clipboard
}

export async function writeClipboardText(
  payload: string,
  driver: DataGridClipboardDriver = {},
): Promise<void> {
  if (driver.writeClipboardText) {
    await driver.writeClipboardText(payload)
    return
  }

  const clipboard = resolveNavigatorClipboard()
  if (clipboard && typeof clipboard.writeText === "function") {
    await clipboard.writeText(payload)
    return
  }

  throw new Error("Clipboard API unavailable")
}

export async function readClipboardText(
  driver: DataGridClipboardDriver = {},
): Promise<string> {
  if (driver.readClipboardText) {
    return driver.readClipboardText()
  }

  const clipboard = resolveNavigatorClipboard()
  if (clipboard && typeof clipboard.readText === "function") {
    return clipboard.readText()
  }

  throw new Error("Clipboard API unavailable")
}