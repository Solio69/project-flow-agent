import { useId, useLayoutEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { ALERT_ROLE, BUTTON_TYPE, SUBMIT_TYPE } from "../../constants/html-attributes";
import { PLUS_ICON } from "../../constants/icons";
import { EMPTY_STRING } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { ProjectIcon } from "../ProjectIcon";
import { TASK_CREATE_COPY, TASK_CREATE_TITLE, type CreatedTaskReceipt, type CreateTask } from "../task-create";
import { CLOSE_ICON, COPY } from "./constants";

export type CreateTaskProject = { path: string; title: string; emoji?: string };
export type RequestCreateTask = (project: CreateTaskProject, control: HTMLButtonElement) => void;

const { field, placeholder, cancel, close: closeLabel, submit, retry, saving } = COPY;
const { failed: createFailed } = TASK_CREATE_COPY;

export function CreateTaskDialog({ project, createTask, onClose }: {
  project: CreateTaskProject;
  createTask?: CreateTask;
  onClose: (taskPath?: string) => void;
}) {
  const { path: projectPath, title: projectName, emoji } = project;
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const headingId = useId();
  const messageId = useId();
  const [taskTitle, setTaskTitle] = useState(EMPTY_STRING);
  const [message, setMessage] = useState(EMPTY_STRING);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CreatedTaskReceipt>();
  const confirmation = pending ? retry : submit;
  const action = busy ? saving : confirmation;
  const messageDescription = message ? messageId : undefined;
  const titleReadOnly = busy || Boolean(pending);
  const submitDisabled = busy || !createTask;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      nameInput.current?.focus({ preventScroll: true });
    }
    return () => (element?.open ? element.close() : undefined);
  }, []);

  function close(taskPath?: string) {
    dialog.current?.close();
    onClose(taskPath);
  }

  const requestClose = () => (submitting.current ? undefined : close());

  function cancelDialog(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !createTask) return;
    submitting.current = true;
    setBusy(true);
    setMessage(EMPTY_STRING);
    try {
      const result = await createTask({ title: taskTitle, projectPath, pending });
      if (result.ok) return close(result.taskPath);

      const { pending: receipt, message: errorMessage } = result;
      setPending(receipt);
      setMessage(errorMessage);
    } catch {
      setMessage(createFailed);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog className="pfa-create-dialog" ref={dialog} aria-labelledby={headingId} onCancel={cancelDialog}>
      <form onSubmit={submitTask}>
        <header className="pfa-create-heading">
          <Icon name={PLUS_ICON} />
          <h2 id={headingId}>{TASK_CREATE_TITLE}</h2>
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
          <button type={BUTTON_TYPE} className="pfa-control" onClick={requestClose} disabled={busy}>{cancel}</button>
          <button type={SUBMIT_TYPE} className="pfa-control" disabled={submitDisabled}>{action}</button>
        </footer>
      </form>
    </dialog>
  );
}
