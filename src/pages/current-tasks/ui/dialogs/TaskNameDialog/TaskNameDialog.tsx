import type { IconName } from "obsidian";
import { useId, useRef, useState, type FormEvent } from "react";
import { ALERT_ROLE, SUBMIT_TYPE } from "../../../../../shared/lib/dom";
import { CLOSE_ICON, ActionButton, Icon } from "../../../../../shared/ui";
import { CLOSE_LABEL, EMPTY_STRING } from "../../../../../shared/lib";
import { ProjectIcon } from "../../ProjectIcon";
import { useTaskDialog } from "../use-task-dialog";
import { COPY } from "./constants";

export type TaskNameProject = { title: string; emoji?: string };
type TaskNameSave = (
  title: string,
) => Promise<{ ok: true; taskPath: string } | { ok: false; message: string }>;
const { field, placeholder, save: saveLabel, saving } = COPY;

function moveCaretToEnd(input: HTMLInputElement) {
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

export function TaskNameDialog({
  project: { title: projectName, emoji },
  heading,
  icon,
  initialTitle = EMPTY_STRING,
  submitLabel = saveLabel,
  failedMessage,
  readOnly: isReadOnly = false,
  save,
  onClose,
}: {
  project: TaskNameProject;
  heading: string;
  icon: IconName;
  initialTitle?: string;
  submitLabel?: string;
  failedMessage: string;
  readOnly?: boolean;
  save?: TaskNameSave;
  onClose: (taskPath?: string) => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);
  const { close, requestClose, dialogProps } = useTaskDialog(
    onClose,
    isSubmitting,
    nameInput,
    moveCaretToEnd,
  );
  const headingId = useId();
  const messageId = useId();
  const [taskTitle, setTaskTitle] = useState(initialTitle);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [isBusy, setIsBusy] = useState(false);
  const action = isBusy ? saving : submitLabel;
  const messageDescription = message ? messageId : undefined;
  const isTitleReadOnly = isBusy || isReadOnly;
  const isSubmitDisabled = isBusy || !save;

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current || !save) return;
    isSubmitting.current = true;
    setIsBusy(true);
    setMessage(EMPTY_STRING);
    try {
      const result = await save(taskTitle);
      if (result.ok) return close(result.taskPath);

      const { message: errorMessage } = result;
      setMessage(errorMessage);
    } catch {
      setMessage(failedMessage);
    } finally {
      isSubmitting.current = false;
      setIsBusy(false);
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
            onClick={isBusy ? undefined : requestClose}
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
              readOnly={isTitleReadOnly}
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
          <button
            type={SUBMIT_TYPE}
            className="pfa-control"
            disabled={isSubmitDisabled}
          >
            {action}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
