import { useRef } from "react";
import type { OpenNote } from "../NoteLink";
import { TaskPanel } from "../TaskPanel";
import { TasksToolbar } from "../TasksToolbar";
import { LIST_KEY_SEPARATOR } from "../current-tasks.constants";
import type { LinkedTaskGroup, TasksSnapshot } from "../obsidian-current-tasks";
import type { SetCompleted } from "../task-completion";
import { isTodayGroup } from "../task-group";
import type { ActionDiagnostic } from "../types";
import {
  COPY,
  DIAGNOSTIC_LABEL_SUFFIX,
  EMPTY_TODAY,
  SPACE,
} from "./constants";

const { diagnosticsTitle, lineLabel } = COPY;

type Panel = { group: LinkedTaskGroup; today: boolean };

function renderDiagnostic({ line, message }: ActionDiagnostic) {
  const label = line && `${lineLabel}${SPACE}${line}${DIAGNOSTIC_LABEL_SUFFIX}`;
  const key = `${line}${LIST_KEY_SEPARATOR}${message}`;
  return (
    <li key={key}>
      {label}
      {message}
    </li>
  );
}

export function TasksList({
  document,
  showCompleted,
  onShowCompletedChange,
  onOpenNote,
  onSetCompleted,
}: {
  document: TasksSnapshot;
  showCompleted: boolean;
  onShowCompletedChange: (visible: boolean) => void;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
}) {
  const { period, groups, diagnostics } = document;
  const completedToggleRef = useRef<HTMLInputElement>(null);
  const diagnosticCount = diagnostics.length;
  const hasDiagnostics = diagnosticCount > 0;
  const todayPanels: Panel[] = [];
  const projectPanels: Panel[] = [];
  for (const group of groups) {
    const today = isTodayGroup(group);
    const destination = today ? todayPanels : projectPanels;
    destination.push({ group, today });
  }
  if (!todayPanels.length)
    todayPanels.push({ group: EMPTY_TODAY, today: true });
  const panels = [...todayPanels, ...projectPanels];

  function focusCompletedToggle() {
    completedToggleRef.current?.focus();
  }

  function renderDiagnostics() {
    return (
      <details className="pfa-diagnostics">
        <summary>
          {diagnosticsTitle} ({diagnosticCount})
        </summary>
        <ul>{diagnostics.map(renderDiagnostic)}</ul>
      </details>
    );
  }

  function renderPanels() {
    const occurrences = new Map<string, number>();
    return panels.map(({ group, today }) => {
      const { kind, link, title } = group;
      const identity = `${kind}${LIST_KEY_SEPARATOR}${link ?? title}`;
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      const key = `${identity}${LIST_KEY_SEPARATOR}${occurrence}`;
      return (
        <TaskPanel
          key={key}
          group={group}
          today={today}
          showCompleted={showCompleted}
          focusCompletedToggle={focusCompletedToggle}
          onOpenNote={onOpenNote}
          onSetCompleted={onSetCompleted}
        />
      );
    });
  }

  return (
    <>
      <TasksToolbar
        period={period}
        showCompleted={showCompleted}
        onShowCompletedChange={onShowCompletedChange}
        completedToggleRef={completedToggleRef}
      />
      {hasDiagnostics && renderDiagnostics()}
      <div className="pfa-task-panels">{renderPanels()}</div>
    </>
  );
}
