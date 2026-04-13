# @affino/datagrid-theme

## Unreleased

### Patch Changes

- ## Summary

  Refreshed the default theme-token baseline with a greener industrial palette, tighter typography defaults, and updated control/selection colors for the current app and spreadsheet shells.

  ## User impact

  Consumers relying on the package default token set will see a more intentional light-on-dark visual baseline for grid chrome, headers, selection states, editors, and menus. Explicit custom token maps and preset overrides continue to win over the defaults.

  ## Migration
  - No migration required.
  - Optional adoption: provide explicit tokens or presets if you need to preserve a previous visual baseline exactly.

  ## Validation
  - downstream app, workbook, and sandbox surfaces render against the refreshed token set
  - package build remains type-safe