import { useId, useRef, useState, type FormEvent } from "react";
import { CLOSE_LABEL, EMPTY_STRING } from "../../../../../shared/lib";
import { ALERT_ROLE, SUBMIT_TYPE } from "../../../../../shared/lib/dom";
import { ActionButton, CLOSE_ICON, Icon } from "../../../../../shared/ui";
import {
  TASK_ARCHIVE_COPY, TASK_ARCHIVE_ICON, type ArchiveReceipt, type ArchiveSelection, type ArchiveTask,
} from "../../../model/task-archive";
import { TASK_EDIT_COPY } from "../../../model/task-edit";
import { ProjectIcon } from "../../ProjectIcon";
import { useTaskDialog } from "../use-task-dialog";

const { title, detail, submit, saving, updating, failed } = TASK_ARCHIVE_COPY;
const { retryListUpdate } = TASK_EDIT_COPY;

export function TaskArchiveDialog({ selection: { task, owner }, archiveTask, onClose }: {
  selection: ArchiveSelection;
  archiveTask?: ArchiveTask;
  onClose: (result?: ArchiveReceipt) => void;
}) {
  const { title: taskTitle } = task;
  const { title: projectTitle, emoji } = owner;
  const closeButton = useRef<HTMLButtonElement>(null);
  const isSubmitting = useRef(false);
  const { close, requestClose, dialogProps } = useTaskDialog(onClose, isSubmitting, closeButton);
  const headingId = useId();
  const detailId = useId();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [pending, setPending] = useState<ArchiveReceipt>();
  const confirmation = pending ? retryListUpdate : submit;
  const progress = pending ? updating : saving;
  const submitLabel = isBusy ? progress : confirmation;
  const description = pending ? taskTitle : detail(taskTitle);
  const isSubmitDisabled = isBusy || !archiveTask;

  async function submitArchive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting.current || !archiveTask) return;
    isSubmitting.current = true;
    setIsBusy(true);
    setMessage(EMPTY_STRING);
    try {
      const result = await archiveTask({ task, pending });
      if (result.ok) {
        const { taskPath } = result;
        return close({ taskPath });
      }
      const { message: errorMessage, pending: receipt } = result;
      setPending(receipt);
      setMessage(errorMessage);
    } catch {
      setMessage(failed);
    } finally {
      isSubmitting.current = false;
      setIsBusy(false);
    }
  }

  return (
    <dialog className="pfa-create-dialog" aria-labelledby={headingId} aria-describedby={detailId} {...dialogProps}>
      <form onSubmit={submitArchive}>
        <header className="pfa-create-heading">
          <Icon name={TASK_ARCHIVE_ICON} />
          <h2 id={headingId}>{title}</h2>
          <ActionButton ref={closeButton} label={CLOSE_LABEL} icon={CLOSE_ICON} onClick={isBusy ? undefined : requestClose} />
        </header>
        <div className="pfa-create-fields">
          <div className="pfa-create-project">
            <ProjectIcon emoji={emoji} />
            <span>{projectTitle}</span>
          </div>
          <p id={detailId}>{description}</p>
          {message && <p className="pfa-create-error" role={ALERT_ROLE}>{message}</p>}
        </div>
        <footer className="pfa-create-actions">
          <button type={SUBMIT_TYPE} className="pfa-control pfa-archive-confirm" disabled={isSubmitDisabled}>
            {submitLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
