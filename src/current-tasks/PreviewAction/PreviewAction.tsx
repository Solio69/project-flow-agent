import type { IconName } from "obsidian";
import { BUTTON_TYPE } from "../../constants/html-attributes";
import { Icon } from "../Icon";

export function PreviewAction({ label, icon, showLabel = false }: {
  label: string;
  icon: IconName;
  showLabel?: boolean;
}) {
  const className = showLabel ? "pfa-control" : "pfa-control pfa-control-icon";

  return (
    <button type={BUTTON_TYPE} className={className} aria-label={label} disabled>
      <Icon name={icon} />
      {showLabel && label}
    </button>
  );
}
