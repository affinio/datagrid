import type {
  DataGridResolvedWorkingCalendar,
  DataGridWorkingCalendar,
} from "./contracts.js"

const DAY_MS = 24 * 60 * 60 * 1000

const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5] as const
const MAX_CALENDAR_SCAN_DAYS = 3660

export function startOfUtcDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function startOfUtcWeek(ms: number): number {
  const dayStartMs = startOfUtcDay(ms)
  const date = new Date(dayStartMs)
  const weekday = date.getUTCDay()
  const deltaDays = (weekday + 6) % 7
  return dayStartMs - (deltaDays * DAY_MS)
}

function normalizeWorkingWeekdays(value: readonly number[] | null | undefined): readonly number[] {
  const weekdays = Array.isArray(value)
    ? Array.from(new Set(
      value
        .map(entry => Number(entry))
        .filter(entry => Number.isInteger(entry) && entry >= 0 && entry <= 6),
    )).sort((left, right) => left - right)
    : []
  return weekdays.length > 0 ? weekdays : [...DEFAULT_WORKING_WEEKDAYS]
}

function normalizeHolidayDayStarts(
  value: readonly (Date | string | number)[] | null | undefined,
): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }
  const normalized = new Set<number>()
  for (const entry of value) {
    const ms = entry instanceof Date
      ? entry.getTime()
      : typeof entry === "number"
        ? entry
        : typeof entry === "string"
          ? Date.parse(entry)
          : NaN
    if (!Number.isFinite(ms)) {
      continue
    }
    normalized.add(startOfUtcDay(ms))
  }
  return Array.from(normalized).sort((left, right) => left - right)
}

export function resolveDataGridWorkingCalendar(
  input: DataGridWorkingCalendar | null | undefined,
): DataGridResolvedWorkingCalendar {
  const workingWeekdays = normalizeWorkingWeekdays(input?.workingWeekdays)
  const holidayDayStarts = normalizeHolidayDayStarts(input?.holidays)
  return {
    workingWeekdays,
    holidayDayStarts,
    workingWeekdaySet: new Set(workingWeekdays),
    holidayDayStartSet: new Set(holidayDayStarts),
  }
}

export function isDataGridWorkingDay(
  dateMs: number,
  calendar: DataGridResolvedWorkingCalendar,
): boolean {
  const dayStartMs = startOfUtcDay(dateMs)
  if (calendar.holidayDayStartSet.has(dayStartMs)) {
    return false
  }
  const weekday = new Date(dayStartMs).getUTCDay()
  return calendar.workingWeekdaySet.has(weekday)
}

export function snapDataGridDateToWorkingDay(
  dateMs: number,
  calendar: DataGridResolvedWorkingCalendar,
  direction: 1 | -1 = 1,
): number {
  const dayStartMs = startOfUtcDay(dateMs)
  if (isDataGridWorkingDay(dayStartMs, calendar)) {
    return dayStartMs
  }
  return findNearestWorkingDay(dayStartMs, direction, calendar)
}

export function addDataGridWorkingDays(
  dateMs: number,
  dayDelta: number,
  calendar: DataGridResolvedWorkingCalendar,
): number {
  let cursorMs = startOfUtcDay(dateMs)
  const normalizedDelta = Math.trunc(dayDelta)
  if (normalizedDelta === 0) {
    return isDataGridWorkingDay(cursorMs, calendar)
      ? cursorMs
      : findNearestWorkingDay(cursorMs, 1, calendar)
  }

  const direction = normalizedDelta > 0 ? 1 : -1
  if (!isDataGridWorkingDay(cursorMs, calendar)) {
    cursorMs = findNearestWorkingDay(cursorMs, direction, calendar)
  }

  for (let stepsRemaining = Math.abs(normalizedDelta); stepsRemaining > 0; stepsRemaining -= 1) {
    cursorMs = findNearestWorkingDay(cursorMs + (direction * DAY_MS), direction, calendar)
  }

  return cursorMs
}

export function buildDataGridNonWorkingDaySpans(
  input: {
    startMs: number
    endMs: number
    calendar: DataGridResolvedWorkingCalendar
  },
): readonly { startMs: number; endMs: number }[] {
  const spans: Array<{ startMs: number; endMs: number }> = []
  let cursorMs = startOfUtcDay(input.startMs)
  let guard = 0

  while (cursorMs < input.endMs && guard < MAX_CALENDAR_SCAN_DAYS) {
    if (!isDataGridWorkingDay(cursorMs, input.calendar)) {
      spans.push({
        startMs: cursorMs,
        endMs: cursorMs + DAY_MS,
      })
    }
    cursorMs += DAY_MS
    guard += 1
  }

  return spans
}

function findNearestWorkingDay(
  dayStartMs: number,
  direction: 1 | -1,
  calendar: DataGridResolvedWorkingCalendar,
): number {
  let cursorMs = dayStartMs
  let guard = 0

  while (!isDataGridWorkingDay(cursorMs, calendar) && guard < MAX_CALENDAR_SCAN_DAYS) {
    cursorMs += direction * DAY_MS
    guard += 1
  }

  return cursorMs
}
