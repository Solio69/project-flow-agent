import { useId, useState } from "react";
import { BUTTON_TYPE, TRUE_STRING } from "../../constants/html-attributes";
import { Icon } from "../Icon";
import { NoteLink, type OpenNote } from "../NoteLink";
import { PreviewAction } from "../PreviewAction";
import { Task } from "../Task";
import type { LinkedTask, LinkedTaskGroup } from "../obsidian-current-tasks";
import { projectAppearance } from "../project-appearance";
import type { SetCompleted } from "../task-completion";
import { COPY, ICONS, MIN_TASKS_FOR_GRIP } from "./constants";

const { emptyToday, emptyProject, collapse, expand, create, archive } = COPY;
const { chevron, add, archive: archiveIcon, folder } = ICONS;

export function TaskPanel({
  group,
  today,
  onOpenNote,
  onSetCompleted,
}: {
  group: LinkedTaskGroup;
  today: boolean;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
}) {
  const { kind, title, tasks, notePath, link } = group;
  const taskCount = tasks.length;
  const hasTasks = taskCount > 0;
  const showGrip = taskCount >= MIN_TASKS_FOR_GRIP;
  const appearance = today ? undefined : projectAppearance(notePath ?? link);
  const listId = useId();
  const [expanded, setExpanded] = useState(true);
  const disclosure = `${expanded ? collapse : expand} «${title}»`;

  function renderTask(task: LinkedTask) {
    const { line } = task;
    return (
      <Task
        key={line}
        task={task}
        today={today}
        showGrip={showGrip}
        onOpenNote={onOpenNote}
        onSetCompleted={onSetCompleted}
      />
    );
  }

  function renderList() {
    if (hasTasks)
      return <ul className="pfa-task-list">{tasks.map(renderTask)}</ul>;
    return (
      <p className="pfa-empty-list">{today ? emptyToday : emptyProject}</p>
    );
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
