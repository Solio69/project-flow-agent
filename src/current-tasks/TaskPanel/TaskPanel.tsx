import { useId, useLayoutEffect, useRef, useState } from "react";
import { BUTTON_TYPE, TRUE_STRING } from "../../constants/html-attributes";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import { PreviewAction } from "../PreviewAction";
import { Task } from "../Task";
import { LIST_KEY_SEPARATOR } from "../current-tasks.constants";
import type { LinkedTask, LinkedTaskGroup } from "../obsidian-current-tasks";
import { projectAppearance } from "../project-appearance";
import { partitionTasksByCompletion, type SetCompleted } from "../task-completion";
import { COPY, ENABLED_TASK_CONTROL, ICONS, MIN_TASKS_FOR_GRIP } from "./constants";

const { emptyToday, emptyProject, allTasksCompleted, collapse, expand, create, archive } = COPY;
const { chevron, add, archive: archiveIcon, folder } = ICONS;

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
}: {
  group: LinkedTaskGroup;
  today: boolean;
  showCompleted: boolean;
  focusCompletedToggle: () => void;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
}) {
  const { kind, title, tasks, notePath, link } = group;
  const { active, completed } = partitionTasksByCompletion(tasks);
  const visibleTasks = showCompleted ? [...active, ...completed] : active;
  const taskCount = visibleTasks.length;
  const canShowGrip = active.length >= MIN_TASKS_FOR_GRIP;
  const hasHiddenTasks = !showCompleted && completed.length > 0;
  const appearance = today ? undefined : projectAppearance(notePath ?? link);
  const listId = useId();
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);
  const completionFocus = useRef<CompletionFocus | null>(null);
  const disclosure = `${expanded ? collapse : expand} «${title}»`;
  const taskOccurrences = new Map<string, number>();

  function rememberCompletionFocus(control: HTMLInputElement) {
    if (showCompleted || control.ownerDocument.activeElement !== control) return;
    const position = enabledTaskControls(listRef.current).indexOf(control);
    if (position < 0) return;
    completionFocus.current = { control, position };
  }

  useLayoutEffect(() => {
    const { current: pending } = completionFocus;
    if (!pending || !onSetCompleted) return;
    completionFocus.current = null;

    const { control, position } = pending;
    const { activeElement, body } = control.ownerDocument;
    if (activeElement !== control && activeElement !== body) return;
    if (control.isConnected && !control.disabled) {
      control.focus();
      return;
    }

    const controls = enabledTaskControls(listRef.current);
    const next = controls[Math.min(position, controls.length - 1)];
    if (next) next.focus();
    else focusCompletedToggle();
  }, [focusCompletedToggle, onSetCompleted]);

  function renderTask(task: LinkedTask) {
    const { line, notePath, link, completed } = task;
    const showGrip = canShowGrip && !completed;
    const identity = notePath ?? link;
    const occurrence = identity === undefined ? 0 : taskOccurrences.get(identity) ?? 0;
    if (identity !== undefined) taskOccurrences.set(identity, occurrence + 1);
    const key = identity === undefined ? line : `${occurrence}${LIST_KEY_SEPARATOR}${identity}`;
    return (
      <Task
        key={key}
        task={task}
        today={today}
        showGrip={showGrip}
        onOpenNote={onOpenNote}
        onSetCompleted={onSetCompleted}
        onTaskMarked={rememberCompletionFocus}
      />
    );
  }

  function renderList() {
    if (taskCount > 0)
      return <ul className="pfa-task-list" ref={listRef}>{visibleTasks.map(renderTask)}</ul>;

    const emptyList = today ? emptyToday : emptyProject;
    return <p className="pfa-empty-list">{hasHiddenTasks ? allTasksCompleted : emptyList}</p>;
  }

  function renderProjectControls() {
    return (
      <div className="pfa-panel-actions">
        <PreviewAction label={`${create}: ${title}`} icon={add} />
        <PreviewAction label={`${archive} «${title}»`} icon={archiveIcon} />
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
        {appearance ? (
          <span className="pfa-project-emoji" aria-hidden={TRUE_STRING}>
            {appearance.emoji}
          </span>
        ) : (
          <Icon name={folder} />
        )}
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
        <h3>
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
