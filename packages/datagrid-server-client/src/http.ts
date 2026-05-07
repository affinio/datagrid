class HttpError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: unknown

  constructor(message: string, status: number, code: string | null = null, details: unknown = null) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function resolveEndpoint(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, baseUrl).toString()
}

function toAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

function isFetchTransportFailure(caught: unknown): boolean {
  if (caught instanceof TypeError) {
    return true
  }
  if (!caught || typeof caught !== "object") {
    return false
  }
  const candidate = caught as { name?: unknown; message?: unknown }
  if (candidate.name === "TypeError") {
    return true
  }
  if (typeof candidate.message !== "string") {
    return false
  }
  const message = candidate.message.toLowerCase()
  return message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
}

let pageLifecycleTeardownStarted = false

function markPageLifecycleTeardownStarted(): void {
  pageLifecycleTeardownStarted = true
}

function resetPageLifecycleTeardownStarted(): void {
  pageLifecycleTeardownStarted = false
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", markPageLifecycleTeardownStarted, { capture: true })
  window.addEventListener("pagehide", markPageLifecycleTeardownStarted, { capture: true })
  window.addEventListener("pageshow", resetPageLifecycleTeardownStarted, { capture: true })
}

function isFetchAbortLikeError(caught: unknown): boolean {
  if (caught instanceof DOMException && caught.name === "AbortError") {
    return true
  }
  if (pageLifecycleTeardownStarted && isFetchTransportFailure(caught)) {
    return true
  }
  if (!(caught instanceof Error)) {
    return false
  }
  return caught.name === "AbortError" || caught.message.toLowerCase().includes("abort")
}

async function parseErrorResponse(response: Response): Promise<HttpError> {
  const fallbackMessage = `${response.status} ${response.statusText}`.trim()
  let parsedBody: unknown = null
  let message = fallbackMessage
  let code: string | null = null

  const text = await response.text()
  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text) as unknown
      if (parsedBody && typeof parsedBody === "object") {
        const candidate = parsedBody as { message?: unknown; code?: unknown }
        if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
          message = candidate.message
        } else {
          message = text
        }
        if (typeof candidate.code === "string" && candidate.code.trim().length > 0) {
          code = candidate.code
        }
      } else {
        message = text
      }
    } catch {
      message = text
      parsedBody = text
    }
  }

  return new HttpError(message, response.status, code, parsedBody ?? text)
}

export async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }

  if (!response.ok) {
    try {
      throw await parseErrorResponse(response)
    } catch (caught) {
      if (signal?.aborted || isFetchAbortLikeError(caught)) {
        throw toAbortError()
      }
      throw caught
    }
  }

  try {
    return (await response.json()) as TResponse
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }
}

export async function getJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "GET",
      signal,
    })
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }

  if (!response.ok) {
    try {
      throw await parseErrorResponse(response)
    } catch (caught) {
      if (signal?.aborted || isFetchAbortLikeError(caught)) {
        throw toAbortError()
      }
      throw caught
    }
  }

  try {
    return (await response.json()) as TResponse
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }
}
