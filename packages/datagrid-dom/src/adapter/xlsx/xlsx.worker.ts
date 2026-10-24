import { writeXlsx, type XlsxWorkbookInput } from "@affino/export-xlsx"

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<XlsxWorkbookInput>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}
worker.onmessage = (event: MessageEvent<XlsxWorkbookInput>): void => {
  try {
    const bytes = writeXlsx(event.data)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    worker.postMessage({ bytes: buffer }, [buffer])
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
