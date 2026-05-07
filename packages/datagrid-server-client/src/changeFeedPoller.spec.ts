import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createChangeFeedPoller } from "./changeFeedPoller"

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe("createChangeFeedPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("start emits polling=true", async () => {
    const diagnostics: Array<{ polling: boolean }> = []
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 3,
      loadSinceVersion: async () => ({}),
      onResponse: () => {},
      onDiagnostics: state => {
        diagnostics.push({ polling: state.polling })
      },
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(diagnostics.some(state => state.polling)).toBe(true)
    poller.stop()
  })

  it("stop emits polling=false and aborts in-flight request", async () => {
    const deferred = createDeferred<{ ok: true }>()
    const signals: AbortSignal[] = []
    const diagnostics: Array<{ polling: boolean; pending: boolean }> = []
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 1,
      loadSinceVersion: async (_sinceVersion, signal) => {
        if (signal) {
          signals.push(signal)
        }
        return await deferred.promise
      },
      onResponse: () => {},
      onDiagnostics: state => {
        diagnostics.push({ polling: state.polling, pending: state.pending })
      },
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()

    expect(signals[0]?.aborted).toBe(true)
    expect(diagnostics.at(-1)).toEqual({ polling: false, pending: false })

    deferred.resolve({ ok: true })
    await Promise.resolve()
  })

  it("does not overlap polls", async () => {
    const deferred = createDeferred<{ ok: true }>()
    const loadSinceVersion = vi.fn(async () => deferred.promise)
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 7,
      loadSinceVersion,
      onResponse: () => {},
    })

    poller.start({ intervalMs: 1 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(loadSinceVersion).toHaveBeenCalledTimes(1)

    deferred.resolve({ ok: true })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)

    expect(loadSinceVersion).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it("uses default and minimum intervals", () => {
    const pollerDefault = createChangeFeedPoller({
      getSinceVersion: () => 0,
      loadSinceVersion: async () => ({}),
      onResponse: () => {},
    })
    pollerDefault.start()
    expect(pollerDefault.diagnostics().intervalMs).toBe(500)
    pollerDefault.stop()

    const pollerMin = createChangeFeedPoller({
      getSinceVersion: () => 0,
      loadSinceVersion: async () => ({}),
      onResponse: () => {},
    })
    pollerMin.start({ intervalMs: 1 })
    expect(pollerMin.diagnostics().intervalMs).toBe(250)
    pollerMin.stop()
  })

  it("pollNow uses the current sinceVersion", async () => {
    const loadSinceVersion = vi.fn(async () => ({}))
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 42,
      loadSinceVersion,
      onResponse: () => {},
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()

    expect(loadSinceVersion).toHaveBeenCalledWith(42, expect.any(Object))
  })

  it("invalid since version calls onInvalidSinceVersion", async () => {
    const error = new Error("invalid")
    const onInvalidSinceVersion = vi.fn()
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 4,
      loadSinceVersion: async () => {
        throw error
      },
      onResponse: () => {},
      isInvalidSinceVersionError: caught => caught === error,
      onInvalidSinceVersion,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()

    expect(onInvalidSinceVersion).toHaveBeenCalledTimes(1)
  })

  it("non-abort errors call onError", async () => {
    const error = new Error("boom")
    const onError = vi.fn()
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 4,
      loadSinceVersion: async () => {
        throw error
      },
      onResponse: () => {},
      onError,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.stop()

    expect(onError).toHaveBeenCalledWith(error)
  })

  it("diagnostics track pending state", async () => {
    const deferred = createDeferred<{ ok: true }>()
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 9,
      loadSinceVersion: async () => deferred.promise,
      onResponse: () => {},
    })

    poller.start()
    expect(poller.diagnostics().pending).toBe(true)

    deferred.resolve({ ok: true })
    await vi.advanceTimersByTimeAsync(0)

    expect(poller.diagnostics().pending).toBe(false)
    poller.stop()
  })

  it("incrementAppliedChanges updates diagnostics", () => {
    const poller = createChangeFeedPoller({
      getSinceVersion: () => 0,
      loadSinceVersion: async () => ({}),
      onResponse: () => {},
    })

    poller.incrementAppliedChanges()
    poller.incrementAppliedChanges(2)

    expect(poller.diagnostics().appliedChanges).toBe(3)
  })
})
