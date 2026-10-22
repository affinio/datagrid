# Datasource control methods

These methods are exposed by `api.data` when the bound row model supplies the datasource backpressure capability. They control queued datasource work; they do not own datasource transport, query policy, or server-side filtering.

| Method | Contract |
| --- | --- |
| `hasBackpressureControlSupport()` | Reports whether all public backpressure controls are available for the bound model. Equivalent to `api.capabilities.backpressureControl`. |
| `pause()` | Requests that the datasource pause processing according to its backpressure contract. Returns whether the pause state changed. |
| `resume()` | Resumes paused processing according to the datasource contract. Returns whether the resume state changed. |
| `flush()` | Waits for queued backpressure work to drain and resolves when the datasource reports completion. It does not wait for Vue/React rendering. |

Check support before adding pause/resume controls. Unsupported calls throw a capability error. Await `flush()` when the caller needs queued work settled; for ongoing synchronization, subscribe to model/API events separately. See the [datasource API reference](../../modules/data-source.md) for datasource protocols and lifecycle details.
