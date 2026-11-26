import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
} from "react";
import {
  BUTTON_TYPE,
  OMIT_FROM_TAB_ORDER,
  TRUE_STRING,
} from "../../../../shared/lib/dom";
import { PLUS_ICON, ActionButton, Icon } from "../../../../shared/ui";
import { LABEL_SEPARATOR } from "../../../../shared/lib";
import type { RequestCreateTask } from "../dialogs/CreateTaskDialog";
import { NoteLink, type OpenNote } from "../NoteLink";
import { ProjectIcon } from "../ProjectIcon";
import type { RequestRenameTask } from "../dialogs/RenameTaskDialog";
import type { RequestArchiveTask } from "../dialogs/TaskArchiveDialog";
import type { RequestTransferTask } from "../dialogs/TaskTransferDialog";
import { Task, type TaskFromButton } from "../Task";
import { LIST_KEY_SEPARATOR } from "../../model/current-tasks.constants";
import type { LinkedTask, LinkedTaskGroup } from "../../model/linked-tasks";
import { projectAppearance } from "./project-appearance";
import {
  partitionTasksByCompletion,
  type SetCompleted,
} from "../../model/task-completion";
import { TASK_CREATE_TITLE } from "../../model/task-create";
import {
  canRestoreTaskFocus,
  focusTaskControl,
  hasTaskControlFocus,
} from "../task-focus";
import type { ReorderTask } from "../../model/task-reorder";
import { describeTaskProjects } from "../../model/task-projects";
import type { TransferReceipt } from "../../model/task-transfer";
import {
  COPY,
  ENABLED_TASK_CONTROL,
  ICONS,
  MIN_TASKS_FOR_GRIP,
  QUOTED_TITLE_PREFIX,
  QUOTED_TITLE_SUFFIX,
} from "./constants";
import { useTaskReorder } from "./use-task-reorder";

const {
  emptyToday,
  emptyProject,
  allTasksCompleted,
  collapse,
  expand,
  archive,
} = COPY;
const { chevron, archive: archiveIcon } = ICONS;

type CompletionFocus = { control: HTMLInputElement; position: number };

function enabledTaskControls(
  list: HTMLUListElement | null,
): HTMLInputElement[] {
  return Array.from(
    list?.querySelectorAll<HTMLInputElement>(ENABLED_TASK_CONTROL) ?? [],
  );
}

export function TaskPanel({
  group,
  today: isToday,
  showCompleted: isCompletedVisible,
  focusCompletedToggle,
  onOpenNote,
  onSetCompleted,
  onMoveTask,
  onReorderTask,
  onRequestCreateTask,
  onRequestRenameTask,
  onRequestTransferTask,
  onRequestArchiveTask,
  projectGroups,
  lastTransfer,
}: {
  group: LinkedTaskGroup;
  today: boolean;
  showCompleted: boolean;
  focusCompletedToggle: () => void;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: TaskFromButton;
  onReorderTask?: ReorderTask;
  onRequestCreateTask?: RequestCreateTask;
  onRequestRenameTask?: RequestRenameTask;
  onRequestTransferTask?: RequestTransferTask;
  onRequestArchiveTask?: RequestArchiveTask;
  projectGroups: LinkedTaskGroup[];
  lastTransfer?: TransferReceipt;
}) {
  const { kind, title, tasks, notePath, link, projectEmoji } = group;
  const { active, completed } = partitionTasksByCompletion(tasks);
  const [isExpanded, setIsExpanded] = useState(true);
  const isGripAvailable = active.length >= MIN_TASKS_FOR_GRIP;
  const reorderTask = isGripAvailable ? onReorderTask : undefined;
  const {
    tasks: orderedActive,
    overlayRef,
    hoverPaused: isHoverPaused,
    onPointerDown,
    onPointerMove,
    onClickCapture,
    onDragStart,
    onKeyDown,
  } = useTaskReorder(group, active, isExpanded, reorderTask);
  const visibleTasks = isCompletedVisible
    ? [...orderedActive, ...completed]
    : orderedActive;
  const taskCount = visibleTasks.length;
  const reorderByKey = reorderTask ? onKeyDown : undefined;
  const isCompletedSectionHidden = !isCompletedVisible && completed.length > 0;
  const appearance = isToday ? undefined : projectAppearance(notePath ?? link);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const completionFocus = useRef<CompletionFocus | null>(null);
  const quotedTitle = `${QUOTED_TITLE_PREFIX}${title}${QUOTED_TITLE_SUFFIX}`;
  const disclosure = `${isExpanded ? collapse : expand}${quotedTitle}`;
  const createLabel = `${TASK_CREATE_TITLE}${LABEL_SEPARATOR}${title}`;
  const requestCreate: MouseEventHandler<HTMLButtonElement> | undefined =
    notePath && onRequestCreateTask
      ? ({ currentTarget }) =>
          onRequestCreateTask(
            { path: notePath, title, emoji: projectEmoji },
            currentTarget,
          )
      : undefined;
  const archiveLabel = `${archive}${quotedTitle}`;
  const taskOccurrences = new Map<string, number>();
  const revealTransfer =
    lastTransfer &&
    lastTransfer.projectPath === notePath &&
    tasks.some(({ notePath: path }) => path === lastTransfer.taskPath)
      ? lastTransfer
      : undefined;

  useLayoutEffect(() => {
    if (revealTransfer) setIsExpanded(true);
  }, [revealTransfer]);

  function rememberCompletionFocus(control: HTMLInputElement) {
    if (isCompletedVisible || !hasTaskControlFocus(control)) return;
    const position = enabledTaskControls(listRef.current).indexOf(control);
    if (position < 0) return;
    completionFocus.current = { control, position };
  }

  useLayoutEffect(() => {
    const { current: pending } = completionFocus;
    if (!pending || !onSetCompleted) return;
    completionFocus.current = null;

    const { control, position } = pending;
    if (!canRestoreTaskFocus(control) || focusTaskControl(control)) return;

    const controls = enabledTaskControls(listRef.current);
    const next = controls[Math.min(position, controls.length - 1)];
    if (!focusTaskControl(next)) focusCompletedToggle();
  }, [focusCompletedToggle, onSetCompleted]);

  function renderTask(task: LinkedTask) {
    const {
      line,
      notePath,
      link,
      id,
      completed: isCompleted,
      project,
      projectEmoji: taskEmoji,
    } = task;
    const isGripVisible = isGripAvailable && !isCompleted;
    const identity = id ?? notePath ?? link;
    const occurrence =
      identity === undefined ? 0 : (taskOccurrences.get(identity) ?? 0);
    if (identity !== undefined) taskOccurrences.set(identity, occurrence + 1);
    const key =
      identity === undefined
        ? line
        : `${occurrence}${LIST_KEY_SEPARATOR}${identity}`;
    const renameFromButton: TaskFromButton | undefined = onRequestRenameTask
      ? (selected, control) =>
          onRequestRenameTask(
            selected,
            {
              title: project ?? title,
              emoji: isToday ? taskEmoji : projectEmoji,
            },
            control,
          )
      : undefined;
    const taskProjects =
      (onRequestTransferTask || onRequestArchiveTask) &&
      notePath &&
      describeTaskProjects(projectGroups, notePath);
    const transferFromButton: TaskFromButton | undefined =
      onRequestTransferTask &&
      taskProjects &&
      taskProjects.destinations.length
        ? (selected, control) =>
            onRequestTransferTask(
              { task: selected, ...taskProjects },
              control,
            )
        : undefined;
    const archiveFromButton: TaskFromButton | undefined =
      onRequestArchiveTask && taskProjects
        ? (selected, control) => onRequestArchiveTask({ task: selected, owner: taskProjects.owner }, control)
        : undefined;
    return (
      <Task
        key={key}
        task={task}
        today={isToday}
        showGrip={isGripVisible}
        onOpenNote={onOpenNote}
        onSetCompleted={onSetCompleted}
        onMoveTask={onMoveTask}
        onRenameTask={renameFromButton}
        onTransferTask={transferFromButton}
        onArchiveTask={archiveFromButton}
        onReorderByKey={reorderByKey}
        onTaskMarked={rememberCompletionFocus}
      />
    );
  }

  function renderList() {
    if (taskCount > 0) {
      return (
        <>
          <ul
            className="pfa-task-list"
            data-hover-paused={isHoverPaused || undefined}
            ref={listRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onClickCapture={onClickCapture}
            onDragStart={onDragStart}
          >
            {visibleTasks.map(renderTask)}
          </ul>
          <ul
            className="pfa-drag-overlay"
            aria-hidden={TRUE_STRING}
            ref={overlayRef}
          />
        </>
      );
    }

    const emptyList = isToday ? emptyToday : emptyProject;
    return (
      <p className="pfa-empty-list">
        {isCompletedSectionHidden ? allTasksCompleted : emptyList}
      </p>
    );
  }

  function renderProjectControls() {
    return (
      <div className="pfa-panel-actions">
        <ActionButton
          label={createLabel}
          icon={PLUS_ICON}
          onClick={requestCreate}
        />
        <ActionButton label={archiveLabel} icon={archiveIcon} />
      </div>
    );
  }

  function renderProjectLead() {
    return (
      <>
        <button
          type={BUTTON_TYPE}
          className="pfa-disclosure"
          aria-label={disclosure}
          aria-controls={listId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          <Icon name={chevron} />
        </button>
        <ProjectIcon emoji={projectEmoji} />
      </>
    );
  }

  return (
    <section
      className="pfa-task-panel"
      data-section={kind}
      data-project-tone={appearance?.tone}
      data-project-path={notePath}
      aria-label={title}
    >
      <header className="pfa-panel-heading">
        {!isToday && renderProjectLead()}
        <h3 tabIndex={OMIT_FROM_TAB_ORDER}>
          <NoteLink note={group} onOpenNote={onOpenNote} />
        </h3>
        {!isToday && renderProjectControls()}
      </header>
      <div className="pfa-panel-content" id={listId} hidden={!isExpanded}>
        {renderList()}
      </div>
    </section>
  );
}
