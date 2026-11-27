import type { TaskPeriod } from "../../model/types";
import {
  COMPACT_RANGE_FORMATS, DATE_RANGE_SEPARATOR, DAY, DAY_MONTH, FULL_RANGE_FORMATS, SAME_MONTH_RANGE_SEPARATOR,
} from "./constants";

export function periodText({ start, end }: TaskPeriod, { isCompact = false } = {}): string {
  const first = new Date(start);
  const last = new Date(end);
  if (start === end) return DAY_MONTH.format(first);

  const isSameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const isSameMonth = isSameYear && first.getUTCMonth() === last.getUTCMonth();
  if (isSameMonth) return `${DAY.format(first)}${SAME_MONTH_RANGE_SEPARATOR}${DAY_MONTH.format(last)}`;

  const { sameYear, differentYear } = isCompact ? COMPACT_RANGE_FORMATS : FULL_RANGE_FORMATS;
  const display = isSameYear ? sameYear : differentYear;
  return `${display.format(first)}${DATE_RANGE_SEPARATOR}${display.format(last)}`;
}
