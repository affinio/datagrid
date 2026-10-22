# Laravel package consolidation

`@affino/datagrid-laravel-app` duplicated the runtime and type exports from
`@affino/datagrid-laravel` without adding Laravel-specific behavior. The
workspace package has been removed; `@affino/datagrid-laravel` is the supported
Laravel/Livewire facade and preserves those exports.

Update installation and imports:

```sh
pnpm remove @affino/datagrid-laravel-app
pnpm add @affino/datagrid-laravel
```

```ts
// Before
import { createDataGridRuntime } from "@affino/datagrid-laravel-app"

// After
import { createDataGridRuntime } from "@affino/datagrid-laravel"
```

Published versions of `@affino/datagrid-laravel-app` are not replaced by this
workspace change. Consumers must migrate to the supported package. Laravel
runtime and type compatibility is checked from packed artifacts by
`pnpm --filter @affino/datagrid-laravel test:tarball-contract`.
