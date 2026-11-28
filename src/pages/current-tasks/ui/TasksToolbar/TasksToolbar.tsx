import type { IconName } from "obsidian";
import type { Ref } from "react";
import { BUTTON_TYPE, GROUP_ROLE, TRUE_STRING } from "../../../../shared/lib/dom";
import { ActionButton, Icon } from "../../../../shared/ui";
import type { ChangePeriod, PeriodSource } from "../../model/task-period";
import type { TaskPeriod } from "../../model/types";
import type { SetCompletedVisible } from "../../model/view-preferences";
import { PeriodControl } from "../PeriodControl";
import { COPY, ICONS } from "./constants";

const { historyLabel, showCompletedLabel, hideCompletedLabel, toolsLabel, collapseProjects, expandProjects, statistics } = COPY;
const { history, showCompleted, hideCompleted, collapse, expand, statistics: statisticsIcon } = ICONS;

type ToolbarTool = {
  label: string;
  icon: IconName;
  onClick?: () => void;
  controlRef?: Ref<HTMLButtonElement>;
  isUnavailable?: boolean;
  isDisabled?: boolean;
};

function renderTool({ label, icon, onClick, controlRef, isUnavailable, isDisabled }: ToolbarTool) {
  return (
    <button
      ref={controlRef}
      type={BUTTON_TYPE}
      className="pfa-tool-button"
      aria-label={label}
      aria-disabled={isUnavailable ? TRUE_STRING : undefined}
      disabled={isDisabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

export function TasksToolbar({
  period,
  isPeriodEditable = false,
  onChangePeriod,
  periodSource,
  showCompleted: isCompletedVisible,
  onShowCompletedChange,
  completedToggleRef,
  isAnyProjectExpanded,
  onToggleProjects,
}: {
  period?: TaskPeriod;
  isPeriodEditable?: boolean;
  onChangePeriod?: ChangePeriod;
  periodSource?: PeriodSource;
  showCompleted: boolean;
  onShowCompletedChange: SetCompletedVisible;
  completedToggleRef: Ref<HTMLButtonElement>;
  isAnyProjectExpanded: boolean;
  onToggleProjects?: () => void;
}) {
  const completedLabel = isCompletedVisible ? hideCompletedLabel : showCompletedLabel;
  const completedIcon = isCompletedVisible ? hideCompleted : showCompleted;
  const projectsLabel = isAnyProjectExpanded ? collapseProjects : expandProjects;
  const projectsIcon = isAnyProjectExpanded ? collapse : expand;
  const isProjectToggleDisabled = !onToggleProjects;
  const toggleCompleted = () => void onShowCompletedChange(!isCompletedVisible);

  return (
    <div className="pfa-tasks-toolbar">
      <PeriodControl period={period} isPeriodEditable={isPeriodEditable} onChangePeriod={onChangePeriod} periodSource={periodSource} />
      <ActionButton label={historyLabel} icon={history} showLabel />
      <div className="pfa-toolbar-tools" role={GROUP_ROLE} aria-label={toolsLabel}>
        {renderTool({
          label: completedLabel,
          icon: completedIcon,
          controlRef: completedToggleRef,
          onClick: toggleCompleted,
        })}
        {renderTool({
          label: projectsLabel,
          icon: projectsIcon,
          isDisabled: isProjectToggleDisabled,
          onClick: onToggleProjects,
        })}
        {renderTool({ label: statistics, icon: statisticsIcon, isUnavailable: true })}
      </div>
    </div>
  );
}
