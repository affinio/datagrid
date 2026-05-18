export class HttpError extends Error {
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

export interface ServerDatasourceRetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
}

export interface ServerDatasourceResolvedRetryOptions {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffFactor: number
}

export interface ServerDatasourceRetryEvent {
  attempt: number
  delayMs: number
  error: unknown
}

export const DEFAULT_SERVER_DATASOURCE_READ_RETRY_OPTIONS: ServerDatasourceResolvedRetryOptions = {
  maxRetries: 2,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffFactor: 2,
}

export function resolveEndpoint(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, baseUrl).toString()
}

export function toAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

export function isFetchTransportFailure(caught: unknown): boolean {
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

export function isFetchAbortLikeError(caught: unknown): boolean {
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

export function normalizeServerDatasourceRetryOptions(
  options: ServerDatasourceRetryOptions | false | undefined,
  defaults: ServerDatasourceResolvedRetryOptions = DEFAULT_SERVER_DATASOURCE_READ_RETRY_OPTIONS,
): ServerDatasourceResolvedRetryOptions | null {
  if (options === false) {
    return null
  }
  const maxRetries = Math.max(0, Math.trunc(options?.maxRetries ?? defaults.maxRetries))
  const initialDelayMs = Math.max(0, Math.trunc(options?.initialDelayMs ?? defaults.initialDelayMs))
  const maxDelayMs = Math.max(initialDelayMs, Math.trunc(options?.maxDelayMs ?? defaults.maxDelayMs))
  const backoffFactor = Number.isFinite(options?.backoffFactor)
    ? Math.max(1, Number(options?.backoffFactor))
    : defaults.backoffFactor
  return {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffFactor,
  }
}

export function isRetryableServerDatasourceReadError(caught: unknown): boolean {
  if (isFetchAbortLikeError(caught)) {
    return false
  }
  if (isFetchTransportFailure(caught)) {
    return true
  }
  if (!caught || typeof caught !== "object") {
    return false
  }
  const status = Number((caught as { status?: unknown }).status)
  if (!Number.isFinite(status)) {
    return false
  }
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)
}

function resolveRetryDelayMs(retry: ServerDatasourceResolvedRetryOptions, attempt: number): number {
  const delay = retry.initialDelayMs * (retry.backoffFactor ** Math.max(0, attempt - 1))
  return Math.min(retry.maxDelayMs, Math.max(0, Math.trunc(delay)))
}

function waitForRetryDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(toAbortError())
  }
  if (ms <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const cleanup = (): void => {
      globalThis.clearTimeout(timeout)
      signal?.removeEventListener("abort", abortListener)
    }
    const abortListener = (): void => {
      cleanup()
      reject(toAbortError())
    }
    signal?.addEventListener("abort", abortListener, { once: true })
  })
}

export async function runWithServerDatasourceRetry<T>(
  operation: () => Promise<T>,
  options: {
    retry?: ServerDatasourceRetryOptions | false
    signal?: AbortSignal
    onRetry?: (event: ServerDatasourceRetryEvent) => void
  } = {},
): Promise<T> {
  const retry = options.retry === undefined ? null : normalizeServerDatasourceRetryOptions(options.retry)
  let attempt = 0
  for (;;) {
    try {
      return await operation()
    } catch (caught) {
      if (options.signal?.aborted || isFetchAbortLikeError(caught)) {
        throw toAbortError()
      }
      if (!retry || attempt >= retry.maxRetries || !isRetryableServerDatasourceReadError(caught)) {
        throw caught
      }
      attempt += 1
      const delayMs = resolveRetryDelayMs(retry, attempt)
      options.onRetry?.({ attempt, delayMs, error: caught })
      await waitForRetryDelay(delayMs, options.signal)
    }
  }
}

export async function parseErrorResponse(response: Response): Promise<HttpError> {
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
  retry?: ServerDatasourceRetryOptions | false,
): Promise<TResponse> {
  return await runWithServerDatasourceRetry(async () => {
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
  }, { retry, signal })
}

export async function getJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  signal?: AbortSignal,
  retry?: ServerDatasourceRetryOptions | false,
): Promise<TResponse> {
  return await runWithServerDatasourceRetry(async () => {
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
  }, { retry, signal })
}
