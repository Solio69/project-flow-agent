import type { IconName } from "obsidian";
import { useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { BUTTON_TYPE, DIALOG_POPUP, GROUP_ROLE, KEYBOARD_KEY } from "../../../../shared/lib/dom";
import { Icon } from "../../../../shared/ui";
import { focusTaskControl } from "../task-focus";
import { TASK_ARCHIVE_COPY, TASK_ARCHIVE_ICON } from "../../model/task-archive";
import { DUPLICATE_TASK_COPY, DUPLICATE_TASK_ICON } from "../../model/task-duplicate";
import { TASK_RENAME_COPY, TASK_RENAME_ICON } from "../../model/task-rename";
import { TASK_TRANSFER_COPY, TASK_TRANSFER_ICON } from "../../model/task-transfer";
import { ACTIONS_ICON, REMOVE_TASK_ACTION, VIEW_CONTENT_SELECTOR } from "./constants";

const { escape } = KEYBOARD_KEY;
const { action: rename } = TASK_RENAME_COPY;
const { action: duplicate } = DUPLICATE_TASK_COPY;
const { action: transfer } = TASK_TRANSFER_COPY;
const { action: archive, hint: archiveHint } = TASK_ARCHIVE_COPY;

type OpenTaskAction = (control: HTMLButtonElement) => void;
type MenuAction = { label: string; icon: IconName; open?: OpenTaskAction; hint?: string; isDialogAction?: boolean };
type MenuPlacement = { isAbove: boolean; maxHeight: number };

export function TaskActionsMenu({ label, onRename, onDuplicate, onTransfer, onArchive }: {
  label: string;
  onRename?: OpenTaskAction;
  onDuplicate?: OpenTaskAction;
  onTransfer?: OpenTaskAction;
  onArchive?: OpenTaskAction;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement>();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const actions: MenuAction[] = [
    { label: rename, icon: TASK_RENAME_ICON, open: onRename, isDialogAction: true },
    { label: duplicate, icon: DUPLICATE_TASK_ICON, open: onDuplicate },
    { label: transfer, icon: TASK_TRANSFER_ICON, open: onTransfer, isDialogAction: true },
    REMOVE_TASK_ACTION,
    { label: archive, icon: TASK_ARCHIVE_ICON, open: onArchive, hint: archiveHint, isDialogAction: true },
  ];
  const firstAvailable = actions.find(({ open: action }) => action);
  const isActionAvailable = Boolean(firstAvailable);
  const isOpen = isActionAvailable && isExpanded;
  const { isAbove = false, maxHeight } = placement ?? {};

  useLayoutEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
      setPlacement(undefined);
      return;
    }
    const { current: button } = trigger;
    const { current: menu } = popup;
    if (!button || !menu) return;
    const viewport = button.closest(VIEW_CONTENT_SELECTOR)?.getBoundingClientRect();
    const { ownerDocument: { documentElement: { clientHeight } } } = button;
    const viewportTop = Math.max(0, viewport?.top ?? 0);
    const viewportBottom = Math.min(clientHeight, viewport?.bottom ?? clientHeight);
    const { top: menuTop, bottom: menuBottom } = menu.getBoundingClientRect();
    const { top: buttonTop, bottom: buttonBottom } = button.getBoundingClientRect();
    const gap = Math.max(0, menuTop - buttonBottom);
    const spaceAbove = buttonTop - viewportTop - gap;
    const spaceBelow = viewportBottom - menuTop;
    const isClippedBelow = menuBottom > viewportBottom;
    const isSpaceAboveLarger = spaceAbove > spaceBelow;
    const isAbove = isClippedBelow && isSpaceAboveLarger;
    const maxHeight = Math.max(0, isAbove ? spaceAbove : spaceBelow);
    setPlacement({ isAbove, maxHeight });
    firstAction.current?.focus({ preventScroll: true });
  }, [isOpen]);

  function close(isFocusReturnRequested: boolean) {
    setIsExpanded(false);
    setPlacement(undefined);
    if (isFocusReturnRequested) focusTaskControl(trigger.current);
  }

  function leave({ currentTarget, relatedTarget }: FocusEvent<HTMLDivElement>) {
    if (isOpen && !currentTarget.contains(relatedTarget)) close(false);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!isOpen || event.key !== escape) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }

  function requestAction(action?: OpenTaskAction) {
    const { current: button } = trigger;
    if (!button || !action) return;
    close(true);
    action(button);
  }

  function renderMenuAction(item: MenuAction) {
    const { label, icon, open: action, hint, isDialogAction } = item;
    const popupType = action && isDialogAction ? DIALOG_POPUP : undefined;
    return (
      <button
        key={label}
        ref={item === firstAvailable ? firstAction : undefined}
        type={BUTTON_TYPE}
        className="pfa-control"
        aria-haspopup={popupType}
        disabled={!action}
        onClick={() => requestAction(action)}
      >
        <Icon name={icon} />
        {hint ? <span>{label}<small>{hint}</small></span> : label}
      </button>
    );
  }

  return (
    <div className="pfa-task-menu-anchor" onBlur={leave} onKeyDown={handleKey}>
      <button
        ref={trigger}
        type={BUTTON_TYPE}
        className="pfa-control pfa-control-icon"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={!isActionAvailable}
        onClick={() => isOpen ? close(true) : setIsExpanded(true)}
      >
        <Icon name={ACTIONS_ICON} />
      </button>
      {isOpen && (
        <div
          id={menuId}
          ref={popup}
          className="pfa-task-menu"
          data-above={isAbove}
          style={{ maxBlockSize: maxHeight }}
          role={GROUP_ROLE}
          aria-label={label}
        >
          <div className="pfa-task-menu-items">{actions.map(renderMenuAction)}</div>
        </div>
      )}
    </div>
  );
}
