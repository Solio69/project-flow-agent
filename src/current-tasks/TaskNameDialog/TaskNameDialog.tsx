import type { IconName } from "obsidian";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  ALERT_ROLE,
  BUTTON_TYPE,
  SUBMIT_TYPE,
} from "../../constants/html-attributes";
import { CLOSE_ICON } from "../../constants/icons";
import { CLOSE_LABEL, EMPTY_STRING } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { ProjectIcon } from "../ProjectIcon";
import { useTaskDialog } from "../use-task-dialog";
import { COPY } from "./constants";

export type TaskNameProject = { title: string; emoji?: string };
type TaskNameSave = (
  title: string,
) => Promise<{ ok: true; taskPath: string } | { ok: false; message: string }>;
const { field, placeholder, cancel, saving } = COPY;

function moveCaretToEnd(input: HTMLInputElement) {
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

export function TaskNameDialog({
  project: { title: projectName, emoji },
  heading,
  icon,
  initialTitle = EMPTY_STRING,
  submitLabel,
  failedMessage,
  readOnly = false,
  dismissOnBackdrop = false,
  save,
  onClose,
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
  const nameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const { close, requestClose, dialogProps } = useTaskDialog(
    onClose,
    submitting,
    nameInput,
    {
      dismissOnBackdrop,
      afterFocus: moveCaretToEnd,
    },
  );
  const headingId = useId();
  const messageId = useId();
  const [taskTitle, setTaskTitle] = useState(initialTitle);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [busy, setBusy] = useState(false);
  const action = busy ? saving : submitLabel;
  const messageDescription = message ? messageId : undefined;
  const titleReadOnly = busy || readOnly;
  const submitDisabled = busy || !save;

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
      aria-labelledby={headingId}
      {...dialogProps}
    >
      <form onSubmit={submitTask}>
        <header className="pfa-create-heading">
          <Icon name={icon} />
          <h2 id={headingId}>{heading}</h2>
          <ActionButton
            label={CLOSE_LABEL}
            icon={CLOSE_ICON}
            onClick={busy ? undefined : requestClose}
          />
        </header>
        <div className="pfa-create-fields">
          <p className="pfa-create-project">
            <ProjectIcon emoji={emoji} />
            <span>{projectName}</span>
          </p>
          <label>
            <input
              ref={nameInput}
              value={taskTitle}
              placeholder={placeholder}
              aria-describedby={messageDescription}
              readOnly={titleReadOnly}
              onChange={({ currentTarget }) =>
                setTaskTitle(currentTarget.value)
              }
            />
            <span>{field}</span>
          </label>
          {message && (
            <p className="pfa-create-error" id={messageId} role={ALERT_ROLE}>
              {message}
            </p>
          )}
        </div>
        <footer className="pfa-create-actions">
          {!dismissOnBackdrop && (
            <button
              type={BUTTON_TYPE}
              className="pfa-control"
              onClick={requestClose}
              disabled={busy}
            >
              {cancel}
            </button>
          )}
          <button
            type={SUBMIT_TYPE}
            className="pfa-control"
            disabled={submitDisabled}
          >
            {action}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
