# @affino/datagrid-vue-app

## 0.1.14

### Patch Changes

- ## Summary

  Added a public `toolbarModules` extension point on `DataGrid` so app teams can append custom toolbar buttons and popovers without replacing the built-in renderer.

  ## User impact

  Consumers can keep the built-in app toolbar modules such as column layout and advanced filter, while adding their own typed toolbar actions through `DataGridAppToolbarModule`.

  ## Migration
  - No migration required.
  - Optional adoption: pass `toolbar-modules` / `toolbarModules` to `DataGrid` instead of replacing the whole renderer when you only need additive toolbar customization.

  ## Validation
  - public facade contract updated for `toolbarModules`
  - package README and shared docs updated
  - sandbox demo + focused spec added