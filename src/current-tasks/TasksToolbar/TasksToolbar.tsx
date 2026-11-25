import type { ChangeEvent, Ref } from "react";
import { CHECKBOX_TYPE, SWITCH_ROLE, TRUE_STRING } from "../../constants/html-attributes";
import { Icon } from "../Icon";
import { PreviewAction } from "../PreviewAction";
import type { TaskPeriod } from "../types";
import { COPY, DAY, DAY_MONTH, FULL_DATE, ICONS } from "./constants";

const { noPeriod, periodLabel, historyLabel, showCompletedLabel } = COPY;
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
  completedToggleRef: Ref<HTMLInputElement>;
}) {
  const text = period ? periodText(period) : noPeriod;

  function changeCompletedVisibility({ currentTarget }: ChangeEvent<HTMLInputElement>) {
    const { checked } = currentTarget;
    onShowCompletedChange(checked);
  }

  return (
    <div className="pfa-tasks-toolbar">
      <p className="pfa-period">
        <Icon name={calendar} />
        <span className="pfa-period-label">{periodLabel} </span>
        {text}
      </p>
      <PreviewAction label={historyLabel} icon={history} showLabel />
      <label className="pfa-completed-toggle">
        <input
          ref={completedToggleRef}
          type={CHECKBOX_TYPE}
          role={SWITCH_ROLE}
          checked={showCompleted}
          onChange={changeCompletedVisibility}
        />
        <span className="pfa-switch-track" aria-hidden={TRUE_STRING} />
        <span>{showCompletedLabel}</span>
      </label>
    </div>
  );
}
