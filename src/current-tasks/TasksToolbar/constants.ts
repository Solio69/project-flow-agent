export const COPY = {
  noPeriod: "Период не задан",
  periodLabel: "Период",
  historyLabel: "Перенести выполненные в историю",
  showCompletedLabel: "Показать выполненные",
  hideCompletedLabel: "Скрыть выполненные",
};

export const ICONS = { calendar: "calendar-days", history: "archive" } as const;

const locale = "ru-RU";
const timeZone = "UTC";
export const DAY = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone });
export const DAY_MONTH = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone });
export const FULL_DATE = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone });
