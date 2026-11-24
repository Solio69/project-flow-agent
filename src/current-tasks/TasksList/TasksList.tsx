import { NoteLink, type OpenNote } from "../NoteLink";
import { Task } from "../Task";
import type { TasksSnapshot } from "../obsidian-current-tasks";
import type { ActionDiagnostic } from "../parse-current-tasks";
import { COPY } from "./constants";

const { periodLabel, diagnosticsTitle, lineLabel, emptyGroups, emptyProject } = COPY;

function displayDate(iso: string): string {
  return iso.split("-").reverse().join(".");
}

function renderDiagnostic({ line, message }: ActionDiagnostic) {
  const label = line && lineLabel + " " + line + ". ";
  return <li key={line + ":" + message}>{label}{message}</li>;
}

export function TasksList({ document, onOpenNote }: { document: TasksSnapshot; onOpenNote: OpenNote }) {
  const { period, groups, diagnostics } = document;
  const hasDiagnostics = diagnostics.length > 0;
  const hasGroups = groups.length > 0;

  function renderDiagnostics() {
    return (
      <details className="pfa-diagnostics">
        <summary>{diagnosticsTitle} ({diagnostics.length})</summary>
        <ul>{diagnostics.map(renderDiagnostic)}</ul>
      </details>
    );
  }

  function renderProjectGroup(group: TasksSnapshot["groups"][number]) {
    const { line, tasks } = group;
    const taskList = tasks.length ? (
      <ul className="pfa-task-list">
        {tasks.map((task) => <Task key={task.line} task={task} onOpenNote={onOpenNote} />)}
      </ul>
    ) : <p>{emptyProject}</p>;

    return (
      <section key={line}>
        <h3><NoteLink note={group} onOpenNote={onOpenNote} /></h3>
        {taskList}
      </section>
    );
  }

  return (
    <>
      {period && <p>{periodLabel} {displayDate(period.start)} — {displayDate(period.end)}</p>}
      {hasDiagnostics && renderDiagnostics()}
      {!hasGroups && <p>{emptyGroups}</p>}
      {groups.map(renderProjectGroup)}
    </>
  );
}
