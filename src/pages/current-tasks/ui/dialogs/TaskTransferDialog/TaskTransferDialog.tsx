import { useId, useRef, useState, type FormEvent } from "react";
import { ALERT_ROLE, RADIO_TYPE, SUBMIT_TYPE } from "../../../../../shared/lib/dom";
import { CLOSE_ICON, ActionButton, Icon } from "../../../../../shared/ui";
import { CLOSE_LABEL, EMPTY_STRING } from "../../../../../shared/lib";
import { ProjectIcon } from "../../ProjectIcon";
import { TASK_EDIT_COPY } from "../../../model/task-edit";
import type { TaskProject } from "../../../model/task-projects";
import {
  TASK_TRANSFER_COPY, TASK_TRANSFER_ICON, type TransferReceipt, type TransferSelection, type TransferTask,
} from "../../../model/task-transfer";
import { useTaskDialog } from "../use-task-dialog";

const { title, destination, origin, submit, saving, failed } = TASK_TRANSFER_COPY;
const { retryListUpdate } = TASK_EDIT_COPY;

export function TaskTransferDialog({ selection: { task, owner, destinations }, transferTask, onClose }: {
  selection: TransferSelection;
  transferTask?: TransferTask;
  onClose: (result?: TransferReceipt) => void;
}) {
  const { title: taskTitle } = task;
  const { title: originTitle } = owner;
  const firstChoice = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);
  const { close, requestClose, dialogProps } = useTaskDialog(onClose, isSubmitting, firstChoice);
  const headingId = useId();
  const groupName = useId();
  const [projectPath, setProjectPath] = useState(EMPTY_STRING);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [isBusy, setIsBusy] = useState(false);
  const [pending, setPending] = useState<TransferReceipt>();
  const confirmation = pending ? retryListUpdate : submit;
  const submitLabel = isBusy ? saving : confirmation;
  const isDestinationSelectionDisabled = isBusy || Boolean(pending);
  const isSubmitDisabled = isBusy || !projectPath || !transferTask;

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current || !transferTask || !projectPath) return;
    isSubmitting.current = true;
    setIsBusy(true);
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
      isSubmitting.current = false;
      setIsBusy(false);
    }
  }

  function renderDestination({ path, title: projectTitle, emoji }: TaskProject, index: number) {
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
          <ActionButton label={CLOSE_LABEL} icon={CLOSE_ICON} onClick={isBusy ? undefined : requestClose} />
        </header>
        <div className="pfa-create-fields">
          <div className="pfa-transfer-summary">
            <strong>{taskTitle}</strong>
            <p>{origin(originTitle)}</p>
          </div>
          <fieldset className="pfa-transfer-projects" disabled={isDestinationSelectionDisabled}>
            <legend>{destination}</legend>
            {destinations.map(renderDestination)}
          </fieldset>
          {message && <p className="pfa-create-error" role={ALERT_ROLE}>{message}</p>}
        </div>
        <footer className="pfa-create-actions">
          <button type={SUBMIT_TYPE} className="pfa-control" disabled={isSubmitDisabled}>
            {submitLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
