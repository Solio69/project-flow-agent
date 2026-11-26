import type { IconName } from "obsidian";
import { useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { BUTTON_TYPE, DIALOG_POPUP, GROUP_ROLE } from "../../constants/html-attributes";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import { Icon } from "../Icon";
import { focusTaskControl } from "../task-focus";
import { TASK_RENAME_COPY, TASK_RENAME_ICON } from "../task-rename";
import { TASK_TRANSFER_COPY, TASK_TRANSFER_ICON } from "../task-transfer";
import { ACTIONS_ICON, TASK_MENU_PLACEHOLDERS, VIEW_CONTENT_SELECTOR } from "./constants";

const { escape } = KEYBOARD_KEY;
const { action: rename } = TASK_RENAME_COPY;
const { action: transfer } = TASK_TRANSFER_COPY;

type OpenTaskAction = (control: HTMLButtonElement) => void;
type DialogAction = { label: string; icon: IconName; open?: OpenTaskAction };

export function TaskActionsMenu({ label, onRename, onTransfer }: {
  label: string;
  onRename?: OpenTaskAction;
  onTransfer?: OpenTaskAction;
}) {
  const [expanded, setExpanded] = useState(false);
  const [above, setAbove] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const actions: DialogAction[] = [
    { label: rename, icon: TASK_RENAME_ICON, open: onRename },
    { label: transfer, icon: TASK_TRANSFER_ICON, open: onTransfer },
  ];
  const firstAvailable = actions.find(({ open: action }) => action);
  const available = Boolean(firstAvailable);
  const open = available && expanded;

  useLayoutEffect(() => {
    if (!open) {
      setExpanded(false);
      setAbove(false);
      return;
    }
    const { current: button } = trigger;
    const { current: menu } = popup;
    if (!button || !menu) return;
    const viewport = button.closest(VIEW_CONTENT_SELECTOR)?.getBoundingClientRect();
    const { ownerDocument } = button;
    const limit = Math.min(viewport?.bottom ?? Infinity, ownerDocument.documentElement.clientHeight);
    const { bottom, height } = menu.getBoundingClientRect();
    const availableAbove = button.getBoundingClientRect().top - (viewport?.top ?? 0);
    setAbove(bottom > limit && availableAbove >= height);
    firstAction.current?.focus({ preventScroll: true });
  }, [open]);

  function close(restoreFocus: boolean) {
    setExpanded(false);
    setAbove(false);
    if (restoreFocus) focusTaskControl(trigger.current);
  }

  function leave({ currentTarget, relatedTarget }: FocusEvent<HTMLDivElement>) {
    if (open && !currentTarget.contains(relatedTarget)) close(false);
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== escape) return;
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

  function renderDialogAction(item: DialogAction) {
    const { label, icon, open: action } = item;
    return (
      <button
        key={label}
        ref={item === firstAvailable ? firstAction : undefined}
        type={BUTTON_TYPE}
        className="pfa-control"
        aria-haspopup={DIALOG_POPUP}
        disabled={!action}
        onClick={() => requestAction(action)}
      >
        <Icon name={icon} />
        {label}
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
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={!available}
        onClick={() => open ? close(true) : setExpanded(true)}
      >
        <Icon name={ACTIONS_ICON} />
      </button>
      {open && (
        <div id={menuId} ref={popup} className="pfa-task-menu" data-above={above} role={GROUP_ROLE} aria-label={label}>
          {actions.map(renderDialogAction)}
          {TASK_MENU_PLACEHOLDERS.map(({ label: actionLabel, hint, icon }) => (
            <button key={actionLabel} type={BUTTON_TYPE} className="pfa-control" disabled>
              <Icon name={icon} />
              <span>{actionLabel}<small>{hint}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
