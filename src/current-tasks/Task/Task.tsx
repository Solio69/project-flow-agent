import type { ChangeEvent, KeyboardEventHandler, MouseEventHandler } from "react";
import { BUTTON_TYPE, CHECKBOX_TYPE, TRUE_STRING } from "../../constants/html-attributes";
import { LABEL_COLON, LABEL_SEPARATOR, SPACE } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import { ProjectIcon } from "../ProjectIcon";
import type { LinkedTask } from "../obsidian-current-tasks";
import type { SetCompleted } from "../task-completion";
import { isEditableTask, type EditableTask } from "../task-edit";
import { COPY, ICONS, OMIT_FROM_TAB_ORDER, REORDER_KEY_SHORTCUTS } from "./constants";

const { checkbox, moveToToday, returnToProject, actions, reorder, reorderHint } = COPY;
const { check, grip, up, down, menu } = ICONS;

export type MoveTaskFromButton = (task: EditableTask, control: HTMLButtonElement) => void;

export function Task({ task, today, showGrip, onOpenNote, onSetCompleted, onMoveTask, onReorderByKey, onTaskMarked }: {
  task: LinkedTask;
  today: boolean;
  showGrip: boolean;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTaskFromButton;
  onReorderByKey?: KeyboardEventHandler<HTMLButtonElement>;
  onTaskMarked: (control: HTMLInputElement) => void;
}) {
  const { completed, project, projectEmoji, title, notePath, line } = task;
  const editableTask = isEditableTask(task) ? task : undefined;
  const canComplete = Boolean(editableTask && onSetCompleted);
  const hasGrip = showGrip && Boolean(editableTask);
  const canReorder = hasGrip && Boolean(onReorderByKey);
  const reorderTabIndex = canReorder ? undefined : OMIT_FROM_TAB_ORDER;
  const titleDraggable = canReorder ? false : undefined;
  const checkboxLabel = `${checkbox}${LABEL_SEPARATOR}${title}`;
  const reorderLabel = `${reorder}${LABEL_SEPARATOR}${title}`;
  const moveAction = today ? returnToProject : moveToToday;
  const moveLabel = `${moveAction}${LABEL_SEPARATOR}${title}`;
  const actionsLabel = `${actions}${LABEL_SEPARATOR}${title}`;
  const moveIcon = today ? down : up;
  const move: MouseEventHandler<HTMLButtonElement> | undefined = editableTask && onMoveTask && !completed
    ? ({ currentTarget }) => onMoveTask(editableTask, currentTarget)
    : undefined;

  function changeCompletion({ currentTarget }: ChangeEvent<HTMLInputElement>) {
    if (!editableTask || !onSetCompleted) return;
    const { checked } = currentTarget;
    if (checked) onTaskMarked(currentTarget);
    void onSetCompleted(editableTask, checked);
  }

  function renderProjectPrefix() {
    if (!today || !project) return null;
    return (
      <>
        <ProjectIcon emoji={projectEmoji} />
        <strong className="pfa-task-project">{project}{LABEL_COLON}</strong>{SPACE}
      </>
    );
  }

  function renderGrip() {
    if (!hasGrip) return <span className="pfa-task-grip" aria-hidden={TRUE_STRING} />;
    return (
      <button
        type={BUTTON_TYPE}
        className="pfa-task-grip"
        aria-label={reorderLabel}
        aria-keyshortcuts={REORDER_KEY_SHORTCUTS}
        aria-disabled={!canReorder}
        tabIndex={reorderTabIndex}
        title={reorderHint}
        onKeyDown={onReorderByKey}
      >
        <Icon name={grip} />
      </button>
    );
  }

  return (
    <li className="pfa-task" data-completed={completed} data-task-line={line}>
      {renderGrip()}
      <label className="pfa-task-mark">
        <input
          type={CHECKBOX_TYPE}
          aria-label={checkboxLabel}
          data-task-path={notePath}
          checked={completed}
          disabled={!canComplete}
          onChange={changeCompletion}
        />
        {completed && <Icon name={check} />}
      </label>
      <span className="pfa-task-label">
        {renderProjectPrefix()}
        <span className="pfa-task-title">
          <NoteLink note={task} onOpenNote={onOpenNote} draggable={titleDraggable} />
        </span>
      </span>
      <div className="pfa-task-actions">
        <ActionButton label={moveLabel} icon={moveIcon} taskPath={notePath} onClick={move} />
        <ActionButton label={actionsLabel} icon={menu} />
      </div>
    </li>
  );
}
