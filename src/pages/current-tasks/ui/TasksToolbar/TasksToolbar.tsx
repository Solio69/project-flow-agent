import type { Ref } from "react";
import { BUTTON_TYPE, TRUE_STRING } from "../../../../shared/lib/dom";
import { LABEL_SEPARATOR } from "../../../../shared/lib";
import { ActionButton, Icon } from "../../../../shared/ui";
import type { TaskPeriod } from "../../model/types";
import { COPY, DAY, DAY_MONTH, FULL_DATE, ICONS } from "./constants";

const { noPeriod, periodLabel, historyLabel, showCompletedLabel, hideCompletedLabel } = COPY;
const { calendar, history } = ICONS;

function periodText({ start, end }: TaskPeriod): string {
  const first = new Date(start);
  const last = new Date(end);
  if (start === end) return DAY_MONTH.format(first);

  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const sameMonth = sameYear && first.getUTCMonth() === last.getUTCMonth();
  if (sameMonth) return `${DAY.format(first)}–${DAY_MONTH.format(last)}`;

  const display = sameYear ? DAY_MONTH : FULL_DATE;
  return `${display.format(first)} — ${display.format(last)}`;
}

export function TasksToolbar({ period, showCompleted, onShowCompletedChange, completedToggleRef }: {
  period?: TaskPeriod;
  showCompleted: boolean;
  onShowCompletedChange: (visible: boolean) => void;
  completedToggleRef: Ref<HTMLButtonElement>;
}) {
  const text = period ? periodText(period) : noPeriod;
  const completedLabel = showCompleted ? hideCompletedLabel : showCompletedLabel;

  return (
    <div className="pfa-tasks-toolbar">
      <p className="pfa-period">
        <Icon name={calendar} />
        <span className="pfa-period-label">{periodLabel}{LABEL_SEPARATOR}</span>
        {text}
      </p>
      <ActionButton label={historyLabel} icon={history} showLabel />
      <button
        ref={completedToggleRef}
        type={BUTTON_TYPE}
        className="pfa-completed-toggle"
        data-show-completed={showCompleted}
        onClick={() => onShowCompletedChange(!showCompleted)}
      >
        <span className="pfa-switch-track" aria-hidden={TRUE_STRING} />
        <span>{completedLabel}</span>
      </button>
    </div>
  );
}
