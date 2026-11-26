import type { IconName } from "obsidian";
import type { ComponentPropsWithRef } from "react";
import { BUTTON_TYPE } from "../../lib/dom";
import { Icon } from "../Icon";

type ActionButtonProps = ComponentPropsWithRef<typeof BUTTON_TYPE> & {
  label: string;
  icon: IconName;
  showLabel?: boolean;
};

export function ActionButton({ label, icon, showLabel: isLabelVisible = false, onClick, ...buttonProps }: ActionButtonProps) {
  const className = isLabelVisible ? "pfa-control" : "pfa-control pfa-control-icon";

  return (
    <button
      {...buttonProps}
      type={BUTTON_TYPE}
      className={className}
      aria-label={label}
      disabled={!onClick}
      onClick={onClick}
    >
      <Icon name={icon} />
      {isLabelVisible && label}
    </button>
  );
}
