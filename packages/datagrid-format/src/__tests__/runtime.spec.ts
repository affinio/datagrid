import { describe, expect, it } from "vitest"

import { formatDataGridCellValue } from "../runtime"

describe("formatDataGridCellValue", () => {
  it("formats currency values via canonical presentation.format", () => {
    expect(formatDataGridCellValue(1234.5, {
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
    })).toBe("£1,234.50")
  })

  it("formats numeric strings when number formatting is configured", () => {
    expect(formatDataGridCellValue("1234.567", {
      presentation: {
        format: {
          number: {
            locale: "en-GB",
            style: "decimal",
            maximumFractionDigits: 1,
          },
        },
      },
    })).toBe("1,234.6")
  })

  it("returns the raw string when number parsing fails", () => {
    expect(formatDataGridCellValue("N/A", {
      presentation: {
        format: {
          number: {
            locale: "en-GB",
            style: "decimal",
            maximumFractionDigits: 1,
          },
        },
      },
    })).toBe("N/A")
  })

  it("formats explicit date values via canonical presentation.format", () => {
    expect(formatDataGridCellValue(new Date("2026-03-01T00:00:00.000Z"), {
      presentation: {
        format: {
          dateTime: {
            locale: "en-GB",
            year: "numeric",
            month: "short",
            day: "2-digit",
            timeZone: "UTC",
          },
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

  it("does not collide number formatter cache keys across option sets", () => {
    expect(formatDataGridCellValue(12, {
      presentation: {
        format: {
          number: {
            locale: "en-GB",
            style: "decimal",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          },
        },
      },
    })).toBe("12")

    expect(formatDataGridCellValue(12, {
      presentation: {
        format: {
          number: {
            locale: "en-GB",
            style: "decimal",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        },
      },
    })).toBe("12.00")
  })

  it("does not collide date formatter cache keys across option sets", () => {
    const value = new Date("2026-03-01T17:05:00.000Z")

    expect(formatDataGridCellValue(value, {
      presentation: {
        format: {
          dateTime: {
            locale: "en-GB",
            timeZone: "UTC",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          },
        },
      },
    })).toBe("17:05")

    expect(formatDataGridCellValue(value, {
      presentation: {
        format: {
          dateTime: {
            locale: "en-US",
            timeZone: "UTC",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          },
        },
      },
    })).toBe("5:05 PM")
  })

})
