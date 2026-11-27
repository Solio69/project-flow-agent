import type { TaskPeriod } from "../types";
import { CALENDAR_ROWS, DAYS_PER_WEEK, ISO_DATE_LENGTH, MAX_YEAR, MIN_YEAR, MONTH_START_DAY } from "./constants";

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function dateKey(date: Date) {
  const year = date.getUTCFullYear();
  if (year >= MIN_YEAR && year <= MAX_YEAR) return formatDateKey(date);
}

export function localToday() {
  const now = new Date();
  const date = new Date(0);
  date.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  return formatDateKey(date);
}

export function shiftCalendarDay(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function shiftCalendarMonth(value: string, months: number) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + months, MONTH_START_DAY);
  return dateKey(date);
}

export function calendarDays(value: string) {
  const month = shiftCalendarMonth(value, 0) ?? value;
  const weekday = new Date(month).getUTCDay();
  const mondayOffset = (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return Array.from({ length: DAYS_PER_WEEK * CALENDAR_ROWS }, (_, index) => shiftCalendarDay(month, index - mondayOffset));
}

export type DateSelection = Partial<TaskPeriod>;

export function selectCalendarDate({ start, end }: DateSelection, date: string): DateSelection {
  if (!start || end) return { start: date };
  return date < start ? { start: date, end: start } : { start, end: date };
}
