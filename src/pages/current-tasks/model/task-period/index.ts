import { EMPTY_STRING } from "../../../../shared/lib";
import { periodDateSchema, readPeriodProperties, writablePeriodProperties } from "../period-properties";
import { PRESERVED_LINE_ENDING, rowPartIndex, TaskEditError } from "../task-edit";
import type { TaskPeriod } from "../types";
import { PERIOD_WRITE_COPY } from "./constants";

export { DAYS_PER_WEEK, PERIOD_WRITE_COPY } from "./constants";
export { calendarDays, localToday, selectCalendarDate, shiftCalendarDay, shiftCalendarMonth, type DateSelection } from "./calendar-dates";
export type PeriodChangeResult = { ok: true } | { ok: false; message: string };
export type PeriodSource = { sourcePath: string; sourceMarkdown: string };
export type ChangePeriod = (period: TaskPeriod | undefined, expectedSource?: PeriodSource) => Promise<PeriodChangeResult>;
const { invalid, unsupported } = PERIOD_WRITE_COPY;

export function updateTaskPeriod(markdown: string, period?: TaskPeriod) {
  if (period) {
    const { start, end } = period;
    if (!periodDateSchema.safeParse(start).success || !periodDateSchema.safeParse(end).success || start > end)
      throw new TaskEditError(invalid);
  }

  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const lines = parts.filter((_, index) => index % 2 === 0);
  const properties = writablePeriodProperties(readPeriodProperties(lines));
  if (!properties) throw new TaskEditError(unsupported);
  const { start, end } = properties;
  parts[rowPartIndex(start.line)] = start.withValue(period?.start);
  parts[rowPartIndex(end.line)] = end.withValue(period?.end);
  return parts.join(EMPTY_STRING);
}
