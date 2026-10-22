# Datasource control methods

These methods are exposed by `api.data` when the bound row model supplies the datasource backpressure capability. They control queued datasource work; they do not own datasource transport, query policy, or server-side filtering.

| Method | Contract |
| --- | --- |
| `hasBackpressureControlSupport()` | Reports whether all public backpressure controls are available for the bound model. Equivalent to `api.capabilities.backpressureControl`. |
| `pause()` | Requests that the datasource pause processing according to its backpressure contract. Returns whether the pause state changed. |
| `resume()` | Resumes paused processing according to the datasource contract. Returns whether the resume state changed. |
| `flush()` | Drains the critical pull currently in flight and critical pulls queued while it drains. It does not wait for background prefetch, future requests submitted after the queue becomes empty, or Vue/React rendering. |

Check support before adding pause/resume controls. Unsupported calls throw a capability error. `flush()` temporarily resumes a paused model to drain critical work, then restores the paused state. Pull failures are absorbed by the datasource runtime and reported through its error/events/diagnostics path; the flush Promise is a queue barrier, not an aggregate success report. If the model is disposed while draining, the barrier resolves after the drain loop observes disposal. Await `flush()` when the caller needs currently accepted foreground work settled; for ongoing synchronization, subscribe to model/API events separately. See the [datasource API reference](../../modules/data-source.md) for datasource protocols and lifecycle details.
