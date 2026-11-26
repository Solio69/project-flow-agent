import type { ChangeEvent, KeyboardEventHandler, MouseEventHandler } from "react";
import { BUTTON_TYPE, CHECKBOX_TYPE, OMIT_FROM_TAB_ORDER, TRUE_STRING } from "../../../../shared/lib/dom";
import { LABEL_COLON, LABEL_SEPARATOR, SPACE } from "../../../../shared/lib";
import { ActionButton, Icon } from "../../../../shared/ui";
import { NoteLink, type OpenNote } from "../NoteLink";
import { ProjectIcon } from "../ProjectIcon";
import { TaskActionsMenu } from "../TaskActionsMenu";
import type { LinkedTask } from "../../model/linked-tasks";
import type { SetCompleted } from "../../model/task-completion";
import { isEditableTask, type EditableTask } from "../../model/task-edit";
import { COPY, ICONS, REORDER_KEY_SHORTCUTS } from "./constants";

const { checkbox, moveToToday, returnToProject, actions, reorder, reorderHint } = COPY;
const { check, grip, up, down } = ICONS;

export type TaskFromButton = (task: EditableTask, control: HTMLButtonElement) => void;

export function Task({
  task, today: isToday, showGrip: isGripVisible, onOpenNote, onSetCompleted, onMoveTask, onRenameTask, onTransferTask, onArchiveTask,
  onReorderByKey, onTaskMarked,
}: {
  task: LinkedTask;
  today: boolean;
  showGrip: boolean;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: TaskFromButton;
  onRenameTask?: TaskFromButton;
  onTransferTask?: TaskFromButton;
  onArchiveTask?: TaskFromButton;
  onReorderByKey?: KeyboardEventHandler<HTMLButtonElement>;
  onTaskMarked: (control: HTMLInputElement) => void;
}) {
  const { completed: isCompleted, project, projectEmoji, title, notePath, line } = task;
  const editableTask = isEditableTask(task) ? task : undefined;
  const isCompletionEnabled = Boolean(editableTask && onSetCompleted);
  const isGripRendered = isGripVisible && Boolean(editableTask);
  const isReorderEnabled = isGripRendered && Boolean(onReorderByKey);
  const reorderTabIndex = isReorderEnabled ? undefined : OMIT_FROM_TAB_ORDER;
  const isTitleDraggable = isReorderEnabled ? false : undefined;
  const checkboxLabel = `${checkbox}${LABEL_SEPARATOR}${title}`;
  const reorderLabel = `${reorder}${LABEL_SEPARATOR}${title}`;
  const moveAction = isToday ? returnToProject : moveToToday;
  const moveLabel = `${moveAction}${LABEL_SEPARATOR}${title}`;
  const actionsLabel = `${actions}${LABEL_SEPARATOR}${title}`;
  const moveIcon = isToday ? down : up;
  const move: MouseEventHandler<HTMLButtonElement> | undefined = editableTask && onMoveTask && !isCompleted
    ? ({ currentTarget }) => onMoveTask(editableTask, currentTarget)
    : undefined;
  const rename = bindAction(onRenameTask);
  const transfer = bindAction(onTransferTask);
  const archive = bindAction(onArchiveTask);

  function bindAction(action?: TaskFromButton) {
    if (editableTask && action) return (control: HTMLButtonElement) => action(editableTask, control);
  }

  function changeCompletion({ currentTarget }: ChangeEvent<HTMLInputElement>) {
    if (!editableTask || !onSetCompleted) return;
    const { checked: isChecked } = currentTarget;
    if (isChecked) onTaskMarked(currentTarget);
    void onSetCompleted(editableTask, isChecked);
  }

  function renderProjectPrefix() {
    if (!isToday || !project) return null;
    return (
      <>
        <ProjectIcon emoji={projectEmoji} />
        <strong className="pfa-task-project">{project}{LABEL_COLON}</strong>{SPACE}
      </>
    );
  }

  function renderGrip() {
    if (!isGripRendered) return <span className="pfa-task-grip" aria-hidden={TRUE_STRING} />;
    return (
      <button
        type={BUTTON_TYPE}
        className="pfa-task-grip"
        aria-label={reorderLabel}
        aria-keyshortcuts={REORDER_KEY_SHORTCUTS}
        aria-disabled={!isReorderEnabled}
        tabIndex={reorderTabIndex}
        title={reorderHint}
        onKeyDown={onReorderByKey}
      >
        <Icon name={grip} />
      </button>
    );
  }

  return (
    <li className="pfa-task" data-completed={isCompleted} data-task-line={line} data-task-path={notePath} tabIndex={OMIT_FROM_TAB_ORDER}>
      {renderGrip()}
      <label className="pfa-task-mark">
        <input
          type={CHECKBOX_TYPE}
          aria-label={checkboxLabel}
          checked={isCompleted}
          disabled={!isCompletionEnabled}
          onChange={changeCompletion}
        />
        {isCompleted && <Icon name={check} />}
      </label>
      <span className="pfa-task-label">
        {renderProjectPrefix()}
        <span className="pfa-task-title">
          <NoteLink note={task} onOpenNote={onOpenNote} draggable={isTitleDraggable} />
        </span>
      </span>
      <div className="pfa-task-actions">
        <ActionButton label={moveLabel} icon={moveIcon} data-task-path={notePath} onClick={move} />
        <TaskActionsMenu label={actionsLabel} onRename={rename} onTransfer={transfer} onArchive={archive} />
      </div>
    </li>
  );
}
