import { useId, useRef, useState, type FormEvent } from "react";
import { ALERT_ROLE, RADIO_TYPE, SUBMIT_TYPE } from "../../../../../shared/lib/dom";
import { CLOSE_ICON, ActionButton, Icon } from "../../../../../shared/ui";
import { CLOSE_LABEL, EMPTY_STRING } from "../../../../../shared/lib";
import { ProjectIcon } from "../../ProjectIcon";
import {
  TASK_TRANSFER_COPY, TASK_TRANSFER_ICON, type TransferProject, type TransferReceipt, type TransferSelection, type TransferTask,
} from "../../../model/task-transfer";
import { useTaskDialog } from "../use-task-dialog";

const { title, destination, origin, submit, retry, saving, failed } = TASK_TRANSFER_COPY;

export function TaskTransferDialog({ selection: { task, owner, destinations }, transferTask, onClose }: {
  selection: TransferSelection;
  transferTask?: TransferTask;
  onClose: (result?: TransferReceipt) => void;
}) {
  const { title: taskTitle } = task;
  const { title: originTitle } = owner;
  const firstChoice = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const { close, requestClose, dialogProps } = useTaskDialog(onClose, submitting, firstChoice);
  const headingId = useId();
  const groupName = useId();
  const [projectPath, setProjectPath] = useState(EMPTY_STRING);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TransferReceipt>();
  const confirmation = pending ? retry : submit;
  const submitLabel = busy ? saving : confirmation;
  const destinationsDisabled = busy || Boolean(pending);
  const submitDisabled = busy || !projectPath || !transferTask;

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !transferTask || !projectPath) return;
    submitting.current = true;
    setBusy(true);
    setMessage(EMPTY_STRING);
    try {
      const result = await transferTask({ task, projectPath, pending });
      if (result.ok) {
        const { taskPath } = result;
        return close({ taskPath, projectPath });
      }
      const { pending: receipt, message: errorMessage } = result;
      setPending(receipt);
      setMessage(errorMessage);
    } catch {
      setMessage(failed);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function renderDestination({ path, title: projectTitle, emoji }: TransferProject, index: number) {
    return (
      <label key={path}>
        <ProjectIcon emoji={emoji} />
        <span>{projectTitle}</span>
        <input
          ref={index === 0 ? firstChoice : undefined}
          type={RADIO_TYPE}
          name={groupName}
          checked={projectPath === path}
          onChange={() => setProjectPath(path)}
        />
      </label>
    );
  }

  return (
    <dialog className="pfa-create-dialog" aria-labelledby={headingId} {...dialogProps}>
      <form onSubmit={submitTransfer}>
        <header className="pfa-create-heading">
          <Icon name={TASK_TRANSFER_ICON} />
          <h2 id={headingId}>{title}</h2>
          <ActionButton label={CLOSE_LABEL} icon={CLOSE_ICON} onClick={busy ? undefined : requestClose} />
        </header>
        <div className="pfa-create-fields">
          <div className="pfa-transfer-summary">
            <strong>{taskTitle}</strong>
            <p>{origin(originTitle)}</p>
          </div>
          <fieldset className="pfa-transfer-projects" disabled={destinationsDisabled}>
            <legend>{destination}</legend>
            {destinations.map(renderDestination)}
          </fieldset>
          {message && <p className="pfa-create-error" role={ALERT_ROLE}>{message}</p>}
        </div>
        <footer className="pfa-create-actions">
          <button type={SUBMIT_TYPE} className="pfa-control" disabled={submitDisabled}>
            {submitLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
