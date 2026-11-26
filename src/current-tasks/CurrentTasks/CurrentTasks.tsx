import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ALERT_ROLE } from "../../constants/html-attributes";
import { CreateTaskDialog, type CreateTaskProject, type RequestCreateTask } from "../CreateTaskDialog";
import { TasksList } from "../TasksList";
import { NoteLink, type OpenNote } from "../NoteLink";
import type { CompletedVisibility } from "../completed-visibility";
import type { SetCompleted } from "../task-completion";
import type { CreateTask } from "../task-create";
import { canRestoreTaskFocus, focusTaskControl } from "../task-focus";
import { PANEL_DISCLOSURE_SELECTOR, TASK_CHECKBOX_PATH_SELECTOR, TASK_PANEL_SELECTOR } from "../task-focus.constants";
import type { ReorderTask } from "../task-reorder";
import type { MoveTask } from "../task-move";
import { LOADING_STATUS } from "./constants";
import { isKindLoading, isKindReady, type CurrentTasksState } from "./state";

type CreateFocus = { control: HTMLButtonElement; taskPath?: string };

function focusCreatedTask(control: HTMLButtonElement, path: string): boolean {
  const panel = control.closest(TASK_PANEL_SELECTOR);
  const checkboxes = panel?.querySelectorAll<HTMLInputElement>(TASK_CHECKBOX_PATH_SELECTOR);
  const checkbox = Array.from(checkboxes ?? []).find(({ dataset: { taskPath } }) => taskPath === path);
  if (focusTaskControl(checkbox)) return true;

  return focusTaskControl(panel?.querySelector<HTMLButtonElement>(PANEL_DISCLOSURE_SELECTOR));
}

export function CurrentTasks({
  title, state, completedVisibility: { get, set, subscribe },
  onOpenNote, onOpenSource, onSetCompleted, onMoveTask, onReorderTask, onCreateTask,
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
}) {
  const showCompleted = useSyncExternalStore(subscribe, get, get);
  const [createProject, setCreateProject] = useState<CreateTaskProject>();
  const createFocus = useRef<CreateFocus | null>(null);
  const ready = isKindReady(state);
  const sourcePath = ready ? state.document.sourcePath : undefined;
  const sourceNote = { title, link: sourcePath, notePath: sourcePath };
  const requestCreateTask: RequestCreateTask | undefined = onCreateTask
    ? (project, control) => {
      createFocus.current = { control };
      setCreateProject(project);
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

  function closeCreateDialog(taskPath?: string) {
    const { current: pending } = createFocus;
    if (pending) pending.taskPath = taskPath;
    setCreateProject(undefined);
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
        />
      );
    }

    const { role, message } = isKindLoading(state)
      ? LOADING_STATUS
      : { role: ALERT_ROLE, message: state.message };
    return <p className="pfa-view-message" role={role}>{message}</p>;
  }

  return (
    <section className="pfa-current-tasks">
      <header className="pfa-page-heading"><h2><NoteLink note={sourceNote} onOpenNote={onOpenSource} /></h2></header>
      {renderContent()}
      {createProject && (
        <CreateTaskDialog project={createProject} createTask={onCreateTask} onClose={closeCreateDialog} />
      )}
    </section>
  );
}
