import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ALERT_ROLE, OMIT_FROM_TAB_ORDER } from "../../../../shared/lib/dom";
import { CreateTaskDialog, type CreateTaskProject, type RequestCreateTask } from "../dialogs/CreateTaskDialog";
import { TasksList } from "../TasksList";
import { NoteLink, type OpenNote } from "../NoteLink";
import { RenameTaskDialog, type RenameSelection, type RequestRenameTask } from "../dialogs/RenameTaskDialog";
import { TaskArchiveDialog, type RequestArchiveTask } from "../dialogs/TaskArchiveDialog";
import { TaskTransferDialog, type RequestTransferTask } from "../dialogs/TaskTransferDialog";
import type { CompletedVisibility } from "../../model/completed-visibility";
import type { ArchiveReceipt, ArchiveSelection, ArchiveTask } from "../../model/task-archive";
import type { SetCompleted } from "../../model/task-completion";
import type { CreateTask } from "../../model/task-create";
import { canRestoreTaskFocus, focusTaskControl, focusTaskElement } from "../task-focus";
import { PANEL_TITLE_SELECTOR, TASK_PANEL_SELECTOR, TASK_ROW_PATH_SELECTOR } from "../task-focus.constants";
import type { ReorderTask } from "../../model/task-reorder";
import type { MoveTask } from "../../model/task-move";
import type { ChangePeriod } from "../../model/task-period";
import type { RenameTask } from "../../model/task-rename";
import type { TransferReceipt, TransferSelection, TransferTask } from "../../model/task-transfer";
import { LOADING_STATUS } from "../../model/view-state.constants";
import { isKindLoading, isKindReady, type CurrentTasksState } from "../../model/view-state";

type CreateFocus = { control: HTMLButtonElement; taskPath?: string };
type TaskActionFocus = { control: HTMLButtonElement; panel: Element | null; isArchived?: boolean };

function getTaskActionFocus(control: HTMLButtonElement): TaskActionFocus {
  return { control, panel: control.closest(TASK_PANEL_SELECTOR) };
}

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
  title, state, completedVisibility: { get, set, subscribe }, onChangePeriod,
  onOpenNote, onOpenSource, onSetCompleted, onMoveTask, onReorderTask, onCreateTask, onRenameTask, onTransferTask, onArchiveTask,
}: {
  title: string;
  state: CurrentTasksState;
  completedVisibility: CompletedVisibility;
  onOpenNote: OpenNote;
  onOpenSource: () => Promise<void>;
  onChangePeriod?: ChangePeriod;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
  onReorderTask?: ReorderTask;
  onCreateTask?: CreateTask;
  onRenameTask?: RenameTask;
  onTransferTask?: TransferTask;
  onArchiveTask?: ArchiveTask;
}) {
  const isCompletedVisible = useSyncExternalStore(subscribe, get, get);
  const [createProject, setCreateProject] = useState<CreateTaskProject>();
  const createFocus = useRef<CreateFocus | null>(null);
  const [renameSelection, setRenameSelection] = useState<RenameSelection>();
  const [archiveSelection, setArchiveSelection] = useState<ArchiveSelection>();
  const taskActionFocus = useRef<TaskActionFocus | null>(null);
  const [transferSelection, setTransferSelection] = useState<TransferSelection>();
  const [lastTransfer, setLastTransfer] = useState<TransferReceipt>();
  const transferFocus = useRef<TaskActionFocus | null>(null);
  const screen = useRef<HTMLElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const isReady = isKindReady(state);
  const sourcePath = isReady ? state.document.sourcePath : undefined;
  const sourceNote = { title, link: sourcePath, notePath: sourcePath };
  const requestCreateTask: RequestCreateTask | undefined = onCreateTask
    ? (project, control) => {
      createFocus.current = { control };
      setCreateProject(project);
    }
    : undefined;
  const requestRenameTask: RequestRenameTask | undefined = isReady && onRenameTask
    ? (task, project, control) => {
      taskActionFocus.current = getTaskActionFocus(control);
      const { document: { sourceMarkdown } } = state;
      setRenameSelection({ task, project, sourceMarkdown });
    }
    : undefined;
  const requestTransferTask: RequestTransferTask | undefined = onTransferTask
    ? (selection, control) => {
      transferFocus.current = getTaskActionFocus(control);
      setLastTransfer(undefined);
      setTransferSelection(selection);
    }
    : undefined;
  const requestArchiveTask: RequestArchiveTask | undefined = onArchiveTask
    ? (selection, control) => {
      taskActionFocus.current = getTaskActionFocus(control);
      setArchiveSelection(selection);
    }
    : undefined;

  useLayoutEffect(() => {
    const { current: pending } = createFocus;
    if (createProject || !pending) return;

    const { control, taskPath } = pending;
    const { disabled: isDisabled, isConnected } = control;
    if (!onCreateTask && isConnected && isDisabled) return;
    createFocus.current = null;
    if (!canRestoreTaskFocus(control)) return;
    if (taskPath && focusCreatedTask(control, taskPath)) return;
    focusTaskControl(control);
  }, [createProject, onCreateTask]);

  useLayoutEffect(() => {
    const { current: pending } = taskActionFocus;
    if (renameSelection || archiveSelection || !pending) return;

    const { control, panel, isArchived } = pending;
    taskActionFocus.current = null;
    if (!canRestoreTaskFocus(control)) return;
    const isTriggerFocused = !isArchived && focusTaskControl(control);
    if (isTriggerFocused) return;
    if (!focusPanelTitle(panel)) focusTaskElement(pageHeading.current);
  }, [archiveSelection, renameSelection]);

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

  function closeArchiveDialog(result?: ArchiveReceipt) {
    const { current: pending } = taskActionFocus;
    if (pending) pending.isArchived = Boolean(result);
    setArchiveSelection(undefined);
  }

  function renderContent() {
    if (isReady) {
      const { document } = state;
      return (
        <TasksList
          document={document}
          onChangePeriod={onChangePeriod}
          showCompleted={isCompletedVisible}
          onShowCompletedChange={set}
          onOpenNote={onOpenNote}
          onSetCompleted={onSetCompleted}
          onMoveTask={onMoveTask}
          onReorderTask={onReorderTask}
          onRequestCreateTask={requestCreateTask}
          onRequestRenameTask={requestRenameTask}
          onRequestTransferTask={requestTransferTask}
          onRequestArchiveTask={requestArchiveTask}
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
      {archiveSelection && (
        <TaskArchiveDialog selection={archiveSelection} archiveTask={onArchiveTask} onClose={closeArchiveDialog} />
      )}
    </section>
  );
}
