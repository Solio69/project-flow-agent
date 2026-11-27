import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import {
  ALERT_ROLE, ARIA_CURRENT_DATE, BUTTON_TYPE, DIALOG_POPUP, GROUP_ROLE, OMIT_FROM_TAB_ORDER, POLITE_LIVE, TRUE_STRING,
} from "../../../../shared/lib/dom";
import { SPACE } from "../../../../shared/lib";
import { ActionButton } from "../../../../shared/ui";
import {
  calendarDays, localToday, shiftCalendarDay, shiftCalendarMonth, type DateSelection,
} from "../../model/task-period";
import type { TaskPeriod } from "../../model/types";
import { COPY, DAY_OFFSETS, FULL_DATE, ICONS, MONTH_NAME, TAB_ORDER, WEEKDAYS } from "./constants";
import { periodText } from "./format";

const { picker, previous, next, days: daysLabel, chooseStart, chooseEnd, apply } = COPY;
const { previous: previousIcon, next: nextIcon } = ICONS;

export function PeriodCalendar({
  id, date, selection: { start, end }, isDayFocusRequested, isDisabled, message, onDate, onNavigate, onApply,
}: {
  id: string;
  date: string;
  selection: DateSelection;
  isDayFocusRequested: boolean;
  isDisabled: boolean;
  message: string;
  onDate: (date: string) => void;
  onNavigate: (date: string, isDayFocusRequested: boolean) => void;
  onApply: (period: TaskPeriod) => void;
}) {
  const focusedDay = useRef<HTMLButtonElement>(null);
  const today = localToday();
  const viewedDate = new Date(date);
  const month = viewedDate.getUTCMonth();
  const heading = MONTH_NAME.format(viewedDate) + SPACE + viewedDate.getUTCFullYear();
  const days = calendarDays(date);
  const previousMonth = shiftCalendarMonth(date, -1);
  const nextMonth = shiftCalendarMonth(date, 1);
  const period = start && end ? { start, end } : undefined;
  const selectionLabel = period ? periodText(period) : start ? chooseEnd : chooseStart;
  const navigatePrevious = !isDisabled && previousMonth ? () => onNavigate(previousMonth, false) : undefined;
  const navigateNext = !isDisabled && nextMonth ? () => onNavigate(nextMonth, false) : undefined;

  useLayoutEffect(() => {
    if (isDayFocusRequested) focusedDay.current?.focus({ preventScroll: true });
  }, [date, isDayFocusRequested]);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    const offset = DAY_OFFSETS[key];
    if (!offset || isDisabled) return;
    event.preventDefault();
    const nextDate = shiftCalendarDay(date, offset);
    if (nextDate) onNavigate(nextDate, true);
  }

  function applyPeriod() {
    if (period && !isDisabled) onApply(period);
  }

  function renderDay(value: string | undefined, index: number) {
    if (!value) return <span key={index} />;
    const day = new Date(value);
    const isSelected = Boolean(start && value >= start && value <= (end ?? start));
    const isFocused = value === date;
    const isToday = value === today;
    const isOutsideMonth = day.getUTCMonth() !== month;
    const isStart = value === start;
    const isEnd = value === end;
    const isPending = isStart && !end;
    return (
      <button
        key={value}
        ref={isFocused ? focusedDay : undefined}
        className="pfa-calendar-day"
        type={BUTTON_TYPE}
        aria-label={FULL_DATE.format(day)}
        aria-current={isToday ? ARIA_CURRENT_DATE : undefined}
        aria-pressed={isSelected}
        tabIndex={isFocused ? TAB_ORDER : OMIT_FROM_TAB_ORDER}
        data-outside={isOutsideMonth || undefined}
        data-start={isStart || undefined}
        data-end={isEnd || undefined}
        data-pending={isPending || undefined}
        disabled={isDisabled}
        onClick={() => onDate(value)}
      >
        {day.getUTCDate()}
      </button>
    );
  }

  return (
    <section className="pfa-period-picker" id={id} role={DIALOG_POPUP} aria-label={picker}>
      <header className="pfa-calendar-head">
        <ActionButton icon={previousIcon} label={previous} onClick={navigatePrevious} />
        <h3 aria-live={POLITE_LIVE}>{heading}</h3>
        <ActionButton icon={nextIcon} label={next} onClick={navigateNext} />
      </header>
      <div className="pfa-calendar-content">
        <div className="pfa-calendar-week" aria-hidden={TRUE_STRING}>{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="pfa-calendar-days" role={GROUP_ROLE} aria-label={daysLabel} onKeyDown={moveFocus}>
          {days.map(renderDay)}
        </div>
      </div>
      <footer className="pfa-calendar-footer">
        <p aria-live={POLITE_LIVE}>{selectionLabel}</p>
        <button type={BUTTON_TYPE} className="pfa-control" disabled={!period} aria-disabled={isDisabled} onClick={applyPeriod}>
          {apply}
        </button>
      </footer>
      {message && <p role={ALERT_ROLE} className="pfa-period-error">{message}</p>}
    </section>
  );
}
