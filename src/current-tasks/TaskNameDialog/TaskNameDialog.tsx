import type { IconName } from "obsidian";
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent, type SyntheticEvent } from "react";
import { ALERT_ROLE, BUTTON_TYPE, SUBMIT_TYPE } from "../../constants/html-attributes";
import { EMPTY_STRING } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { ProjectIcon } from "../ProjectIcon";
import { CLOSE_ICON, COPY } from "./constants";

export type TaskNameProject = { title: string; emoji?: string };
type TaskNameSave = (title: string) => Promise<{ ok: true; taskPath: string } | { ok: false; message: string }>;
const { field, placeholder, cancel, close: closeLabel, saving } = COPY;

function isBackdrop({ target, currentTarget, clientX, clientY }: MouseEvent<HTMLDialogElement>) {
  if (target !== currentTarget) return false;
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect();
  return clientX < left || clientX > right || clientY < top || clientY > bottom;
}

export function TaskNameDialog({
  project: { title: projectName, emoji }, heading, icon, initialTitle = EMPTY_STRING,
  submitLabel, failedMessage, readOnly = false, dismissOnBackdrop = false, save, onClose,
}: {
  project: TaskNameProject;
  heading: string;
  icon: IconName;
  initialTitle?: string;
  submitLabel: string;
  failedMessage: string;
  readOnly?: boolean;
  dismissOnBackdrop?: boolean;
  save?: TaskNameSave;
  onClose: (taskPath?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const pressedBackdrop = useRef(false);
  const headingId = useId();
  const messageId = useId();
  const [taskTitle, setTaskTitle] = useState(initialTitle);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [busy, setBusy] = useState(false);
  const action = busy ? saving : submitLabel;
  const messageDescription = message ? messageId : undefined;
  const titleReadOnly = busy || readOnly;
  const submitDisabled = busy || !save;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      const { current: input } = nameInput;
      if (input) {
        const end = input.value.length;
        input.focus({ preventScroll: true });
        input.setSelectionRange(end, end);
      }
    }
    return () => (element?.open ? element.close() : undefined);
  }, []);

  function close(taskPath?: string) {
    dialog.current?.close();
    onClose(taskPath);
  }

  const requestClose = () => (submitting.current ? undefined : close());

  function captureBackdropPress(event: MouseEvent<HTMLDialogElement>) {
    pressedBackdrop.current = isBackdrop(event);
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const dismiss = pressedBackdrop.current && isBackdrop(event);
    pressedBackdrop.current = false;
    if (dismiss) requestClose();
  }

  function cancelDialog(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !save) return;
    submitting.current = true;
    setBusy(true);
    setMessage(EMPTY_STRING);
    try {
      const result = await save(taskTitle);
      if (result.ok) return close(result.taskPath);

      const { message: errorMessage } = result;
      setMessage(errorMessage);
    } catch {
      setMessage(failedMessage);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      className="pfa-create-dialog"
      ref={dialog}
      aria-labelledby={headingId}
      onCancel={cancelDialog}
      onPointerDown={dismissOnBackdrop ? captureBackdropPress : undefined}
      onClick={dismissOnBackdrop ? dismissFromBackdrop : undefined}
    >
      <form onSubmit={submitTask}>
        <header className="pfa-create-heading">
          <Icon name={icon} />
          <h2 id={headingId}>{heading}</h2>
          <ActionButton label={closeLabel} icon={CLOSE_ICON} onClick={busy ? undefined : requestClose} />
        </header>
        <div className="pfa-create-fields">
          <p className="pfa-create-project"><ProjectIcon emoji={emoji} /><span>{projectName}</span></p>
          <label>
            <input
              ref={nameInput}
              value={taskTitle}
              placeholder={placeholder}
              aria-describedby={messageDescription}
              readOnly={titleReadOnly}
              onChange={({ currentTarget }) => setTaskTitle(currentTarget.value)}
            />
            <span>{field}</span>
          </label>
          {message && <p className="pfa-create-error" id={messageId} role={ALERT_ROLE}>{message}</p>}
        </div>
        <footer className="pfa-create-actions">
          {!dismissOnBackdrop && (
            <button type={BUTTON_TYPE} className="pfa-control" onClick={requestClose} disabled={busy}>{cancel}</button>
          )}
          <button type={SUBMIT_TYPE} className="pfa-control" disabled={submitDisabled}>{action}</button>
        </footer>
      </form>
    </dialog>
  );
}
