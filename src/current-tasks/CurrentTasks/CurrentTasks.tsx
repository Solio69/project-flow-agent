import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ALERT_ROLE, OMIT_FROM_TAB_ORDER } from "../../constants/html-attributes";
import { CreateTaskDialog, type CreateTaskProject, type RequestCreateTask } from "../CreateTaskDialog";
import { TasksList } from "../TasksList";
import { NoteLink, type OpenNote } from "../NoteLink";
import { RenameTaskDialog, type RenameSelection, type RequestRenameTask } from "../RenameTaskDialog";
import { TaskTransferDialog } from "../TaskTransferDialog";
import type { CompletedVisibility } from "../completed-visibility";
import type { SetCompleted } from "../task-completion";
import type { CreateTask } from "../task-create";
import { canRestoreTaskFocus, focusTaskControl, focusTaskElement } from "../task-focus";
import { PANEL_TITLE_SELECTOR, TASK_PANEL_SELECTOR, TASK_ROW_PATH_SELECTOR } from "../task-focus.constants";
import type { ReorderTask } from "../task-reorder";
import type { MoveTask } from "../task-move";
import type { RenameTask } from "../task-rename";
import type { RequestTransferTask, TransferReceipt, TransferSelection, TransferTask } from "../task-transfer";
import { LOADING_STATUS } from "./constants";
import { isKindLoading, isKindReady, type CurrentTasksState } from "./state";

type CreateFocus = { control: HTMLButtonElement; taskPath?: string };
type TaskActionFocus = { control: HTMLButtonElement; panel: Element | null };

function focusPanelTitle(panel: Element | null) {
  return focusTaskElement(panel?.querySelector<HTMLHeadingElement>(PANEL_TITLE_SELECTOR));
}

function focusCreatedTask(control: HTMLButtonElement, path: string): boolean {
  const panel = control.closest(TASK_PANEL_SELECTOR);
  const rows = panel?.querySelectorAll<HTMLLIElement>(TASK_ROW_PATH_SELECTOR);
  const row = Array.from(rows ?? []).find(({ dataset: { taskPath } }) => taskPath === path);
  if (focusTaskElement(row)) return true;

  return focusPanelTitle(panel);
}

export function CurrentTasks({
  title, state, completedVisibility: { get, set, subscribe },
  onOpenNote, onOpenSource, onSetCompleted, onMoveTask, onReorderTask, onCreateTask, onRenameTask, onTransferTask,
}: {
  title: string;
  state: CurrentTasksState;
  completedVisibility: CompletedVisibility;
  onOpenNote: OpenNote;
  onOpenSource: () => Promise<void>;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
  onReorderTask?: ReorderTask;
  onCreateTask?: CreateTask;
  onRenameTask?: RenameTask;
  onTransferTask?: TransferTask;
}) {
  const showCompleted = useSyncExternalStore(subscribe, get, get);
  const [createProject, setCreateProject] = useState<CreateTaskProject>();
  const createFocus = useRef<CreateFocus | null>(null);
  const [renameSelection, setRenameSelection] = useState<RenameSelection>();
  const renameFocus = useRef<TaskActionFocus | null>(null);
  const [transferSelection, setTransferSelection] = useState<TransferSelection>();
  const [lastTransfer, setLastTransfer] = useState<TransferReceipt>();
  const transferFocus = useRef<TaskActionFocus | null>(null);
  const screen = useRef<HTMLElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const ready = isKindReady(state);
  const sourcePath = ready ? state.document.sourcePath : undefined;
  const sourceNote = { title, link: sourcePath, notePath: sourcePath };
  const requestCreateTask: RequestCreateTask | undefined = onCreateTask
    ? (project, control) => {
      createFocus.current = { control };
      setCreateProject(project);
    }
    : undefined;
  const requestRenameTask: RequestRenameTask | undefined = ready && onRenameTask
    ? (task, project, control) => {
      renameFocus.current = { control, panel: control.closest(TASK_PANEL_SELECTOR) };
      setRenameSelection({ task, project, sourceMarkdown: state.document.sourceMarkdown });
    }
    : undefined;
  const requestTransferTask: RequestTransferTask | undefined = onTransferTask
    ? (selection, control) => {
      transferFocus.current = { control, panel: control.closest(TASK_PANEL_SELECTOR) };
      setLastTransfer(undefined);
      setTransferSelection(selection);
    }
    : undefined;

  useLayoutEffect(() => {
    const { current: pending } = createFocus;
    if (createProject || !pending) return;

    const { control, taskPath } = pending;
    const { disabled, isConnected } = control;
    if (!onCreateTask && isConnected && disabled) return;
    createFocus.current = null;
    if (!canRestoreTaskFocus(control)) return;
    if (taskPath && focusCreatedTask(control, taskPath)) return;
    focusTaskControl(control);
  }, [createProject, onCreateTask]);

  useLayoutEffect(() => {
    const { current: pending } = renameFocus;
    if (renameSelection || !pending) return;

    const { control, panel } = pending;
    renameFocus.current = null;
    if (!canRestoreTaskFocus(control) || focusTaskControl(control)) return;
    if (!focusPanelTitle(panel)) focusTaskElement(pageHeading.current);
  }, [renameSelection]);

  useLayoutEffect(() => {
    const { current: pending } = transferFocus;
    if (transferSelection || !pending) return;

    const { control, panel } = pending;
    transferFocus.current = null;
    if (!canRestoreTaskFocus(control) || focusTaskControl(control)) return;

    const panels = screen.current?.querySelectorAll<HTMLElement>(TASK_PANEL_SELECTOR);
    const destination = lastTransfer && Array.from(panels ?? []).find(({ dataset: { projectPath } }) =>
      projectPath === lastTransfer.projectPath);
    if (!focusPanelTitle(destination ?? panel)) focusTaskElement(pageHeading.current);
  }, [lastTransfer, transferSelection]);

  function closeCreateDialog(taskPath?: string) {
    const { current: pending } = createFocus;
    if (pending) pending.taskPath = taskPath;
    setCreateProject(undefined);
  }

  function closeTransferDialog(result?: TransferReceipt) {
    setLastTransfer(result);
    setTransferSelection(undefined);
  }

  function renderContent() {
    if (ready) {
      const { document } = state;
      return (
        <TasksList
          document={document}
          showCompleted={showCompleted}
          onShowCompletedChange={set}
          onOpenNote={onOpenNote}
          onSetCompleted={onSetCompleted}
          onMoveTask={onMoveTask}
          onReorderTask={onReorderTask}
          onRequestCreateTask={requestCreateTask}
          onRequestRenameTask={requestRenameTask}
          onRequestTransferTask={requestTransferTask}
          lastTransfer={lastTransfer}
        />
      );
    }

    const { role, message } = isKindLoading(state)
      ? LOADING_STATUS
      : { role: ALERT_ROLE, message: state.message };
    return <p className="pfa-view-message" role={role}>{message}</p>;
  }

  return (
    <section className="pfa-current-tasks" ref={screen}>
      <header className="pfa-page-heading">
        <h2 ref={pageHeading} tabIndex={OMIT_FROM_TAB_ORDER}>
          <NoteLink note={sourceNote} onOpenNote={onOpenSource} />
        </h2>
      </header>
      {renderContent()}
      {createProject && (
        <CreateTaskDialog project={createProject} createTask={onCreateTask} onClose={closeCreateDialog} />
      )}
      {renameSelection && (
        <RenameTaskDialog selection={renameSelection} renameTask={onRenameTask} onClose={() => setRenameSelection(undefined)} />
      )}
      {transferSelection && (
        <TaskTransferDialog selection={transferSelection} transferTask={onTransferTask} onClose={closeTransferDialog} />
      )}
    </section>
  );
}
