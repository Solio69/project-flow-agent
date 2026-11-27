import type { Ref } from "react";
import { BUTTON_TYPE, TRUE_STRING } from "../../../../shared/lib/dom";
import { ActionButton } from "../../../../shared/ui";
import type { ChangePeriod, PeriodSource } from "../../model/task-period";
import type { TaskPeriod } from "../../model/types";
import { PeriodControl } from "../PeriodControl";
import { COPY, ICONS } from "./constants";

const { historyLabel, showCompletedLabel, hideCompletedLabel } = COPY;
const { history } = ICONS;

export function TasksToolbar({
  period, isPeriodEditable = false, onChangePeriod, periodSource,
  showCompleted: isCompletedVisible, onShowCompletedChange, completedToggleRef,
}: {
  period?: TaskPeriod;
  isPeriodEditable?: boolean;
  onChangePeriod?: ChangePeriod;
  periodSource?: PeriodSource;
  showCompleted: boolean;
  onShowCompletedChange: (visible: boolean) => void;
  completedToggleRef: Ref<HTMLButtonElement>;
}) {
  const completedLabel = isCompletedVisible ? hideCompletedLabel : showCompletedLabel;

  return (
    <div className="pfa-tasks-toolbar">
      <PeriodControl period={period} isPeriodEditable={isPeriodEditable} onChangePeriod={onChangePeriod} periodSource={periodSource} />
      <ActionButton label={historyLabel} icon={history} showLabel />
      <button
        ref={completedToggleRef}
        type={BUTTON_TYPE}
        className="pfa-completed-toggle"
        data-show-completed={isCompletedVisible}
        onClick={() => onShowCompletedChange(!isCompletedVisible)}
      >
        <span className="pfa-switch-track" aria-hidden={TRUE_STRING} />
        <span>{completedLabel}</span>
      </button>
    </div>
  );
}
