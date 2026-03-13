import { describe, expect, it } from "vitest"

import { formatDataGridCellValue } from "../runtime"

describe("formatDataGridCellValue", () => {
  it("formats currency values via Intl.NumberFormat", () => {
    expect(formatDataGridCellValue(1234.5, {
      presentation: {
        numberFormat: {
          locale: "en-GB",
          style: "currency",
          currency: "GBP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      },
    })).toBe("£1,234.50")
  })

  it("formats numeric strings when number formatting is configured", () => {
    expect(formatDataGridCellValue("1234.567", {
      presentation: {
        numberFormat: {
          locale: "en-GB",
          style: "decimal",
          maximumFractionDigits: 1,
        },
      },
    })).toBe("1,234.6")
  })

  it("returns the raw string when number parsing fails", () => {
    expect(formatDataGridCellValue("N/A", {
      presentation: {
        numberFormat: {
          locale: "en-GB",
          style: "decimal",
          maximumFractionDigits: 1,
        },
      },
    })).toBe("N/A")
  })

  it("formats explicit date values via Intl.DateTimeFormat", () => {
    expect(formatDataGridCellValue(new Date("2026-03-01T00:00:00.000Z"), {
      presentation: {
        dateTimeFormat: {
          locale: "en-GB",
          year: "numeric",
          month: "short",
          day: "2-digit",
          timeZone: "UTC",
        },
      },
    })).toBe("01 Mar 2026")
  })

  it("applies readable default date formatting for date columns", () => {
    const expected = new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date("2026-03-01T00:00:00.000Z"))

    expect(formatDataGridCellValue("2026-03-01T00:00:00.000Z", {
      dataType: "date",
    })).toBe(expected)
  })
})
