import { writeXlsx, type XlsxWorkbookInput } from "@affino/export-xlsx"

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<XlsxWorkbookInput>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

workerScope.onmessage = (event: MessageEvent<XlsxWorkbookInput>) => {
  try {
    const bytes = writeXlsx(event.data)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    workerScope.postMessage({ bytes: buffer }, [buffer])
  } catch (error) {
    workerScope.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
