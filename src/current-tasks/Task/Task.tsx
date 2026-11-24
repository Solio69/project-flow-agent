import { NoteLink, type OpenNote } from "../NoteLink";
import type { LinkedTask } from "../obsidian-current-tasks";
import { COPY } from "./constants";

const { completedStatus, pendingStatus } = COPY;

export function Task({ task, onOpenNote }: { task: LinkedTask; onOpenNote: OpenNote }) {
  const { completed, project } = task;
  const { label, mark } = completed ? completedStatus : pendingStatus;

  return (
    <li className="pfa-task">
      <span role="img" aria-label={label} className="pfa-task-mark">
        {mark}
      </span>
      <span>
        <NoteLink note={task} onOpenNote={onOpenNote} />
        {project && <span className="pfa-task-project"> · {project}</span>}
      </span>
    </li>
  );
}
