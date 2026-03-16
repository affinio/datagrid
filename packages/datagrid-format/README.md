# DataGrid Format Engine

`@affino/datagrid-format` is the headless display-formatting engine for Affino DataGrid.

It owns:

- number and currency formatting
- date and datetime formatting
- `Intl` formatter caching
- display-only conversion from raw cell values to readable strings

It does not own:

- row data
- editing state
- clipboard serialization
- framework rendering

## Purpose

The package lets adapters format only the cells they actually render, while keeping
raw values untouched for editing and mutations.

```ts
import { formatDataGridCellValue } from "@affino/datagrid-format"

const display = formatDataGridCellValue(1234.5, {
  presentation: {
    format: {
      number: {
        locale: "en-GB",
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    },
  },
})
```

## Column Contract

The engine is designed to back DataGrid column presentation:

- `presentation.format.number`
- `presentation.format.dateTime`
- fallback date presets via `dataType: "date" | "datetime"`

These affect display only.
Raw values should continue to flow through editing, clipboard, and patch pipelines unchanged.

```ts
import { formatDataGridCellValue } from "@affino/datagrid-format"

const dateLabel = formatDataGridCellValue("2026-03-01T00:00:00.000Z", {
  dataType: "date",
})
```

## Public API

- `formatDataGridCellValue(value, column)` formats numbers, currency, percent, date, and datetime display values.
- `resolveDefaultDataGridDateTimeFormat(dataType)` returns the built-in readable preset for `date` and `datetime` columns.

## Architecture

```text
raw value
  -> column presentation
  -> @affino/datagrid-format
  -> display string
  -> adapter renderer
```

## Notes

- `Intl.NumberFormat` and `Intl.DateTimeFormat` instances are cached by locale and options.
- The engine is intentionally headless so Vue, Laravel, and other adapters can share the same formatting behavior.
