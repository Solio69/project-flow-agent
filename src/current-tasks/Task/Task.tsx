import type { ChangeEvent } from "react";
import { CHECKBOX_TYPE, TRUE_STRING } from "../../constants/html-attributes";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import { PreviewAction } from "../PreviewAction";
import type { LinkedTask } from "../obsidian-current-tasks";
import { projectAppearance } from "../project-appearance";
import { isCompletionTarget, type SetCompleted } from "../task-completion";
import { COPY, ICONS } from "./constants";

const { checkbox, moveToToday, returnToProject, actions } = COPY;
const { check, grip, up, down, menu } = ICONS;

export function Task({ task, today, showGrip, onOpenNote, onSetCompleted }: {
  task: LinkedTask;
  today: boolean;
  showGrip: boolean;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
}) {
  const { completed, project, projectPath, title } = task;
  const appearance = projectAppearance(projectPath);
  const editableTask = isCompletionTarget(task) ? task : undefined;
  const canComplete = Boolean(editableTask && onSetCompleted);
  const moveLabel = today ? returnToProject : moveToToday;
  const moveIcon = today ? down : up;

  function changeCompletion({ currentTarget }: ChangeEvent<HTMLInputElement>) {
    if (!editableTask || !onSetCompleted) return;
    const { checked } = currentTarget;
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
        <strong className="pfa-task-project">{project}:</strong>{" "}
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
          aria-label={`${checkbox}: ${title}`}
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
        <PreviewAction label={`${moveLabel}: ${title}`} icon={moveIcon} />
        <PreviewAction label={`${actions}: ${title}`} icon={menu} />
      </div>
    </li>
  );
}
