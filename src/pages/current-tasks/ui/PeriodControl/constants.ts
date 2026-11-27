import { KEYBOARD_KEY } from "../../../../shared/lib/dom";
import { DAYS_PER_WEEK } from "../../model/task-period";

export const COPY = {
  period: "Период",
  noPeriod: "Период не задан",
  choose: "Выбрать даты",
  picker: "Выбрать даты периода",
  clear: "Удалить даты периода",
  previous: "Предыдущий месяц",
  next: "Следующий месяц",
  days: "Дни календаря",
  chooseStart: "Выбери дату начала",
  chooseEnd: "Выбери дату окончания",
  apply: "Применить",
} as const;

export const ICONS = { calendar: "calendar-days", previous: "chevron-left", next: "chevron-right" } as const;
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const { arrowLeft, arrowRight, arrowUp, arrowDown } = KEYBOARD_KEY;
export const DAY_OFFSETS: Readonly<Record<string, number | undefined>> = {
  [arrowLeft]: -1, [arrowRight]: 1, [arrowUp]: -DAYS_PER_WEEK, [arrowDown]: DAYS_PER_WEEK,
};

const locale = "ru-RU";
const timeZone = "UTC";
export const DAY = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone });
export const DAY_MONTH = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone });
export const FULL_DATE = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone });
export const COMPACT_RANGE_FORMATS = {
  sameYear: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone }),
  differentYear: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone }),
};
export const FULL_RANGE_FORMATS = { sameYear: DAY_MONTH, differentYear: FULL_DATE };
export const MONTH_NAME = new Intl.DateTimeFormat(locale, { month: "long", timeZone });
export const TAB_ORDER = 0;
export const SAME_MONTH_RANGE_SEPARATOR = "–";
export const DATE_RANGE_SEPARATOR = " — ";
