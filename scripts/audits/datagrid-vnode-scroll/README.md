# Vue scroll / null VNode reproduction audit

Consumer-only browser fixture for the Vue 3.5.40 `shouldUpdateComponent` null
`emitsOptions` report. It imports `DataGrid`, `createDataSourceBackedRowModel`,
and `createAffinoDatasource` from their public package roots.

The Chromium matrix covers `layout-mode="fill"`, virtualization, initial
`total=0`, `total>0` with empty pulls, a delayed pull resolved after native wheel
scroll, fourteen columns with custom cell renderers, advanced filter, state
persistence with viewport position and `restoreOnReady`, and the simple
`DataGridDataSource` versus `createAffinoDatasource` paths. A test-only CSS
pseudo-element supplies scroll extent while the server has no materialized
rows; it does not change the grid's Vue child tree.

Run dev mode:

```sh
VUE_RUNTIME=/tmp/affino-vnode-scroll/vue-runtime/node_modules/vue/dist/vue.esm-bundler.js \
  pnpm exec vite --config scripts/audits/datagrid-vnode-scroll/vite.config.mts
node scripts/audits/datagrid-vnode-scroll/run-browser.mjs
```

For production, build with the same `VUE_RUNTIME`, start `vite preview` with the
same config, then run the browser script with
`VNODE_SCROLL_BASE_URL=http://127.0.0.1:4196` (or the preview port).

Result in this workspace: no Vue runtime error in dev or production across the
matrix. This does not reproduce a VNode with `component === null` reaching
`shouldUpdateComponent`; therefore it does not establish the old/new VNode pair
or justify a renderer lifecycle change. Nivvi's host renderer/slot tree remains
the missing comparison point.
