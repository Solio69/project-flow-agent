import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { EMPTY_STRING, LABEL_SEPARATOR } from "../../../../shared/lib";
import { ALERT_ROLE, BUTTON_TYPE, DIALOG_POPUP, DOM_EVENT, KEYBOARD_KEY } from "../../../../shared/lib/dom";
import { CLOSE_ICON, Icon } from "../../../../shared/ui";
import {
  localToday, PERIOD_WRITE_COPY, selectCalendarDate, type ChangePeriod, type DateSelection, type PeriodSource,
} from "../../model/task-period";
import type { TaskPeriod } from "../../model/types";
import { COPY, ICONS } from "./constants";
import { periodText } from "./format";
import { PeriodCalendar } from "./PeriodCalendar";

const { period: periodLabel, noPeriod, choose, clear } = COPY;
const { failed } = PERIOD_WRITE_COPY;
const { calendar: calendarIcon } = ICONS;
const { escape } = KEYBOARD_KEY;
type Draft = {
  selection: DateSelection;
  date: string;
  isDayFocusRequested: boolean;
  source?: PeriodSource;
};

function isPeriodFocusRestorable(element: HTMLDivElement | null) {
  if (!element) return false;
  const { ownerDocument: { activeElement, body } } = element;
  return activeElement === body || element.contains(activeElement);
}

export function PeriodControl({ period, isPeriodEditable, onChangePeriod, periodSource }: {
  period?: TaskPeriod;
  isPeriodEditable: boolean;
  onChangePeriod?: ChangePeriod;
  periodSource?: PeriodSource;
}) {
  const [draft, setDraft] = useState<Draft>();
  const [message, setMessage] = useState(EMPTY_STRING);
  const [isSaving, setIsSaving] = useState(false);
  const isSaveInFlight = useRef(false);
  const isTriggerFocusRequested = useRef(false);
  const control = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pickerId = useId();
  const isOpen = isPeriodEditable && Boolean(draft);
  const isDisabled = isSaving || !onChangePeriod;
  const emptyLabel = isPeriodEditable ? choose : noPeriod;
  const text = period ? periodText(period, { isCompact: isPeriodEditable }) : emptyLabel;
  const label = `${periodLabel}${LABEL_SEPARATOR}${text}`;
  const triggerLabel = period ? periodText(period) : choose;
  const error = message && !isOpen ? <p role={ALERT_ROLE} className="pfa-period-error">{message}</p> : null;

  useLayoutEffect(() => {
    if (!isPeriodEditable) {
      isTriggerFocusRequested.current = false;
      setDraft(undefined);
      return;
    }
    if (isOpen || isDisabled || !isTriggerFocusRequested.current) return;
    isTriggerFocusRequested.current = false;
    if (isPeriodFocusRestorable(control.current)) trigger.current?.focus({ preventScroll: true });
  }, [isDisabled, isOpen, isPeriodEditable]);

  useEffect(() => {
    const element = control.current;
    if (!isOpen || !element) return;
    const { ownerDocument } = element;
    const dismissOutside = (event: PointerEvent) => {
      const isOutside = !event.composedPath().includes(element);
      if (isOutside && !isSaveInFlight.current) setDraft(undefined);
    };
    ownerDocument.addEventListener(DOM_EVENT.pointerDown, dismissOutside, true);
    return () => ownerDocument.removeEventListener(DOM_EVENT.pointerDown, dismissOutside, true);
  }, [isOpen]);

  function dismiss() {
    isTriggerFocusRequested.current = isPeriodFocusRestorable(control.current);
    setDraft(undefined);
  }

  function toggle() {
    if (isDisabled) return;
    setMessage(EMPTY_STRING);
    if (draft) return dismiss();
    setDraft({ selection: period ?? {}, date: period?.start ?? localToday(), isDayFocusRequested: true, source: periodSource });
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (!isOpen || isSaveInFlight.current || event.key !== escape) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  }

  function closeOnBlur({ currentTarget, relatedTarget }: FocusEvent<HTMLDivElement>) {
    const isFocusLeaving = Boolean(relatedTarget && !currentTarget.contains(relatedTarget));
    if (isFocusLeaving && !isSaveInFlight.current) setDraft(undefined);
  }

  async function save(next?: TaskPeriod) {
    if (isSaveInFlight.current || !onChangePeriod) return;
    isSaveInFlight.current = true;
    setIsSaving(true);
    setMessage(EMPTY_STRING);
    const expected = next ? draft?.source : periodSource;
    try {
      const result = await onChangePeriod(next, expected);
      if (result.ok) {
        dismiss();
      } else {
        const { message: error } = result;
        setMessage(error);
      }
    } catch {
      setMessage(failed);
    } finally {
      isSaveInFlight.current = false;
      setIsSaving(false);
    }
  }

  function navigateCalendar(date: string, isDayFocusRequested: boolean) {
    setDraft((previous) => previous && { ...previous, date, isDayFocusRequested });
  }

  function chooseCalendarDate(date: string) {
    setDraft((previous) => {
      if (!previous) return;
      const { selection } = previous;
      return { ...previous, date, selection: selectCalendarDate(selection, date), isDayFocusRequested: true };
    });
  }

  function renderCalendar({ date, selection, isDayFocusRequested }: Draft) {
    return (
      <PeriodCalendar
        id={pickerId}
        date={date}
        selection={selection}
        isDayFocusRequested={isDayFocusRequested}
        isDisabled={isDisabled}
        message={message}
        onNavigate={navigateCalendar}
        onDate={chooseCalendarDate}
        onApply={save}
      />
    );
  }

  if (!isPeriodEditable) {
    return (
      <div className="pfa-period-control">
        <p className="pfa-period" aria-label={label}>
          <Icon name={calendarIcon} />
          {text}
        </p>
        {error}
      </div>
    );
  }

  return (
    <div className="pfa-period-control" ref={control} onKeyDown={closeOnEscape} onBlur={closeOnBlur}>
      <div className="pfa-period-trigger">
        <button
          className="pfa-period"
          type={BUTTON_TYPE}
          ref={trigger}
          aria-label={triggerLabel}
          aria-haspopup={DIALOG_POPUP}
          aria-expanded={isOpen}
          aria-controls={draft ? pickerId : undefined}
          aria-disabled={isDisabled}
          onClick={toggle}
        >
          <Icon name={calendarIcon} />
          <span className="pfa-period-text">{text}</span>
        </button>
        {period && (
          <button className="pfa-period-clear" type={BUTTON_TYPE} aria-label={clear} title={clear} aria-disabled={isDisabled} onClick={() => void save()}>
            <Icon name={CLOSE_ICON} />
          </button>
        )}
      </div>
      {draft && renderCalendar(draft)}
      {error}
    </div>
  );
}
