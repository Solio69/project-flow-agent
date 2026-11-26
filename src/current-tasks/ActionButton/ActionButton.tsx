import type { IconName } from "obsidian";
import type { MouseEventHandler } from "react";
import { BUTTON_TYPE } from "../../constants/html-attributes";
import { Icon } from "../Icon";

export function ActionButton({ label, icon, showLabel = false, taskPath, onClick }: {
  label: string;
  icon: IconName;
  showLabel?: boolean;
  taskPath?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const className = showLabel ? "pfa-control" : "pfa-control pfa-control-icon";

  return (
    <button
      type={BUTTON_TYPE}
      className={className}
      aria-label={label}
      data-task-path={taskPath}
      disabled={!onClick}
      onClick={onClick}
    >
      <Icon name={icon} />
      {showLabel && label}
    </button>
  );
}
