export const DAYS_PER_WEEK = 7;
export const CALENDAR_ROWS = 6;
export const MONTH_START_DAY = 1;
export const ISO_DATE_LENGTH = 10;
export const MIN_YEAR = 0;
export const MAX_YEAR = 9999;

export const PERIOD_WRITE_COPY = {
  invalid: "Укажите корректные даты начала и окончания периода.",
  unsupported: "Проверьте свойства period_start и period_end в исходной заметке.",
  failed: "Не удалось сохранить даты периода.",
  staleDraft: "Заметка изменилась. Откройте календарь заново.",
} as const;
