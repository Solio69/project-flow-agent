import { useId, useLayoutEffect, useRef, useState, type MouseEventHandler } from "react";
import { BUTTON_TYPE, OMIT_FROM_TAB_ORDER, TRUE_STRING } from "../../constants/html-attributes";
import { PLUS_ICON } from "../../constants/icons";
import { LABEL_SEPARATOR } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import type { RequestCreateTask } from "../CreateTaskDialog";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import { ProjectIcon } from "../ProjectIcon";
import type { RequestRenameTask } from "../RenameTaskDialog";
import { Task, type TaskFromButton } from "../Task";
import { LIST_KEY_SEPARATOR } from "../current-tasks.constants";
import type { LinkedTask, LinkedTaskGroup } from "../obsidian-current-tasks";
import { projectAppearance } from "../project-appearance";
import { partitionTasksByCompletion, type SetCompleted } from "../task-completion";
import { TASK_CREATE_TITLE } from "../task-create";
import { canRestoreTaskFocus, focusTaskControl, hasTaskControlFocus } from "../task-focus";
import type { ReorderTask } from "../task-reorder";
import { COPY, ENABLED_TASK_CONTROL, ICONS, MIN_TASKS_FOR_GRIP, QUOTED_TITLE_PREFIX, QUOTED_TITLE_SUFFIX } from "./constants";
import { useTaskReorder } from "./use-task-reorder";

const { emptyToday, emptyProject, allTasksCompleted, collapse, expand, archive } = COPY;
const { chevron, archive: archiveIcon } = ICONS;

type CompletionFocus = { control: HTMLInputElement; position: number };

function enabledTaskControls(list: HTMLUListElement | null): HTMLInputElement[] {
  return Array.from(list?.querySelectorAll<HTMLInputElement>(ENABLED_TASK_CONTROL) ?? []);
}

export function TaskPanel({
  group,
  today,
  showCompleted,
  focusCompletedToggle,
  onOpenNote,
  onSetCompleted,
  onMoveTask,
  onReorderTask,
  onRequestCreateTask,
  onRequestRenameTask,
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
}) {
  const { kind, title, tasks, notePath, link, projectEmoji } = group;
  const { active, completed } = partitionTasksByCompletion(tasks);
  const [expanded, setExpanded] = useState(true);
  const canShowGrip = active.length >= MIN_TASKS_FOR_GRIP;
  const reorderTask = canShowGrip ? onReorderTask : undefined;
  const {
    tasks: orderedActive, overlayRef, hoverPaused, onPointerDown, onPointerMove, onClickCapture, onDragStart, onKeyDown,
  } = useTaskReorder(group, active, expanded, reorderTask);
  const visibleTasks = showCompleted ? [...orderedActive, ...completed] : orderedActive;
  const taskCount = visibleTasks.length;
  const reorderByKey = reorderTask ? onKeyDown : undefined;
  const hasHiddenTasks = !showCompleted && completed.length > 0;
  const appearance = today ? undefined : projectAppearance(notePath ?? link);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const completionFocus = useRef<CompletionFocus | null>(null);
  const quotedTitle = `${QUOTED_TITLE_PREFIX}${title}${QUOTED_TITLE_SUFFIX}`;
  const disclosure = `${expanded ? collapse : expand}${quotedTitle}`;
  const createLabel = `${TASK_CREATE_TITLE}${LABEL_SEPARATOR}${title}`;
  const requestCreate: MouseEventHandler<HTMLButtonElement> | undefined = notePath && onRequestCreateTask
    ? ({ currentTarget }) => onRequestCreateTask({ path: notePath, title, emoji: projectEmoji }, currentTarget)
    : undefined;
  const archiveLabel = `${archive}${quotedTitle}`;
  const taskOccurrences = new Map<string, number>();

  function rememberCompletionFocus(control: HTMLInputElement) {
    if (showCompleted || !hasTaskControlFocus(control)) return;
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
    const { line, notePath, link, id, completed, project, projectEmoji: taskEmoji } = task;
    const showGrip = canShowGrip && !completed;
    const identity = id ?? notePath ?? link;
    const occurrence = identity === undefined ? 0 : taskOccurrences.get(identity) ?? 0;
    if (identity !== undefined) taskOccurrences.set(identity, occurrence + 1);
    const key = identity === undefined ? line : `${occurrence}${LIST_KEY_SEPARATOR}${identity}`;
    const renameFromButton: TaskFromButton | undefined = onRequestRenameTask
      ? (selected, control) => onRequestRenameTask(selected, {
        title: project ?? title,
        emoji: today ? taskEmoji : projectEmoji,
      }, control)
      : undefined;
    return (
      <Task
        key={key}
        task={task}
        today={today}
        showGrip={showGrip}
        onOpenNote={onOpenNote}
        onSetCompleted={onSetCompleted}
        onMoveTask={onMoveTask}
        onRenameTask={renameFromButton}
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
            data-hover-paused={hoverPaused || undefined}
            ref={listRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onClickCapture={onClickCapture}
            onDragStart={onDragStart}
          >
            {visibleTasks.map(renderTask)}
          </ul>
          <ul className="pfa-drag-overlay" aria-hidden={TRUE_STRING} ref={overlayRef} />
        </>
      );
    }

    const emptyList = today ? emptyToday : emptyProject;
    return <p className="pfa-empty-list">{hasHiddenTasks ? allTasksCompleted : emptyList}</p>;
  }

  function renderProjectControls() {
    return (
      <div className="pfa-panel-actions">
        <ActionButton label={createLabel} icon={PLUS_ICON} onClick={requestCreate} />
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
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
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
      aria-label={title}
    >
      <header className="pfa-panel-heading">
        {!today && renderProjectLead()}
        <h3 tabIndex={OMIT_FROM_TAB_ORDER}>
          <NoteLink note={group} onOpenNote={onOpenNote} />
        </h3>
        {!today && renderProjectControls()}
      </header>
      <div className="pfa-panel-content" id={listId} hidden={!expanded}>
        {renderList()}
      </div>
    </section>
  );
}
