import { useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { BUTTON_TYPE, GROUP_ROLE } from "../../constants/html-attributes";
import { KEYBOARD_KEY } from "../../constants/keyboard";
import { Icon } from "../Icon";
import { focusTaskControl } from "../task-focus";
import { TASK_RENAME_COPY, TASK_RENAME_ICON } from "../task-rename";
import { ACTIONS_ICON, VIEW_CONTENT_SELECTOR } from "./constants";

const { escape } = KEYBOARD_KEY;
const { action: rename } = TASK_RENAME_COPY;

export function TaskActionsMenu({ label, onRename }: {
  label: string;
  onRename?: (control: HTMLButtonElement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [above, setAbove] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const open = Boolean(onRename && expanded);

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

  function requestRename() {
    const { current: button } = trigger;
    if (!button || !onRename) return;
    close(true);
    onRename(button);
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
        disabled={!onRename}
        onClick={() => open ? close(true) : setExpanded(true)}
      >
        <Icon name={ACTIONS_ICON} />
      </button>
      {open && (
        <div id={menuId} ref={popup} className="pfa-task-menu" data-above={above} role={GROUP_ROLE} aria-label={label}>
          <button ref={firstAction} type={BUTTON_TYPE} className="pfa-control" onClick={requestRename}>
            <Icon name={TASK_RENAME_ICON} />
            {rename}
          </button>
        </div>
      )}
    </div>
  );
}
