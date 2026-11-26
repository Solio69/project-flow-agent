import type { ChangeEvent, MouseEventHandler } from "react";
import { CHECKBOX_TYPE, TRUE_STRING } from "../../constants/html-attributes";
import { LABEL_COLON, LABEL_SEPARATOR, SPACE } from "../../constants/text";
import { ActionButton } from "../ActionButton";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import type { LinkedTask } from "../obsidian-current-tasks";
import { projectAppearance } from "../project-appearance";
import type { SetCompleted } from "../task-completion";
import { isEditableTask, type EditableTask } from "../task-edit";
import { COPY, ICONS } from "./constants";

const { checkbox, moveToToday, returnToProject, actions } = COPY;
const { check, grip, up, down, menu } = ICONS;

export type MoveTaskFromButton = (task: EditableTask, control: HTMLButtonElement) => void;

export function Task({ task, today, showGrip, onOpenNote, onSetCompleted, onMoveTask, onTaskMarked }: {
  task: LinkedTask;
  today: boolean;
  showGrip: boolean;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTaskFromButton;
  onTaskMarked: (control: HTMLInputElement) => void;
}) {
  const { completed, project, projectPath, title, notePath } = task;
  const appearance = projectAppearance(projectPath);
  const editableTask = isEditableTask(task) ? task : undefined;
  const canComplete = Boolean(editableTask && onSetCompleted);
  const checkboxLabel = `${checkbox}${LABEL_SEPARATOR}${title}`;
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
        {appearance && (
          <span className="pfa-project-emoji" aria-hidden={TRUE_STRING}>
            {appearance.emoji}
          </span>
        )}
        <strong className="pfa-task-project">{project}{LABEL_COLON}</strong>{SPACE}
      </>
    );
  }

  return (
    <li className="pfa-task" data-completed={completed}>
      <span className="pfa-task-grip" aria-hidden={TRUE_STRING}>
        {showGrip && <Icon name={grip} />}
      </span>
      <label className="pfa-task-mark">
        <input
          type={CHECKBOX_TYPE}
          aria-label={checkboxLabel}
          checked={completed}
          disabled={!canComplete}
          onChange={changeCompletion}
        />
        {completed && <Icon name={check} />}
      </label>
      <span className="pfa-task-label">
        {renderProjectPrefix()}
        <span className="pfa-task-title"><NoteLink note={task} onOpenNote={onOpenNote} /></span>
      </span>
      <div className="pfa-task-actions">
        <ActionButton label={moveLabel} icon={moveIcon} taskPath={notePath} onClick={move} />
        <ActionButton label={actionsLabel} icon={menu} />
      </div>
    </li>
  );
}
