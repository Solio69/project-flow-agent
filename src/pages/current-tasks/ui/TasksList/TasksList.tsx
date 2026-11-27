import { useLayoutEffect, useRef } from "react";
import { SPACE } from "../../../../shared/lib";
import type { RequestCreateTask } from "../dialogs/CreateTaskDialog";
import type { OpenNote } from "../NoteLink";
import type { RequestRenameTask } from "../dialogs/RenameTaskDialog";
import type { TaskFromButton } from "../Task";
import { TaskPanel } from "../TaskPanel";
import { TasksToolbar } from "../TasksToolbar";
import { LIST_KEY_SEPARATOR, TASK_GROUP_KIND } from "../../model/current-tasks.constants";
import type { LinkedTaskGroup, TasksSnapshot } from "../../model/linked-tasks";
import type { SetCompleted } from "../../model/task-completion";
import {
  canRestoreTaskFocus,
  focusTaskControl,
  hasTaskControlFocus,
} from "../task-focus";
import {
  PANEL_DISCLOSURE_SELECTOR,
  TASK_PANEL_SELECTOR,
  TASK_ROW_PATH_SELECTOR,
} from "../task-focus.constants";
import { isTodayGroup } from "../../model/task-group";
import type { MoveTask } from "../../model/task-move";
import type { CopyTaskPath } from "../../model/task-note-path";
import type { ChangePeriod } from "../../model/task-period";
import type { ReorderTask } from "../../model/task-reorder";
import type { TransferReceipt } from "../../model/task-transfer";
import type { RequestTransferTask } from "../dialogs/TaskTransferDialog";
import type { RequestArchiveTask } from "../dialogs/TaskArchiveDialog";
import type { ActionDiagnostic } from "../../model/types";
import {
  COPY,
  DIAGNOSTIC_LABEL_SUFFIX,
  EMPTY_TODAY,
  MOVE_FOCUS_OPTIONS,
  TASK_MOVE_CONTROL_SELECTOR,
} from "./constants";

const { diagnosticsTitle, lineLabel } = COPY;

type Panel = { group: LinkedTaskGroup; isToday: boolean };
type MoveOrigin = { panel: HTMLElement; nearbyRows: (Element | null | undefined)[] };
type MoveFocus = { control: HTMLButtonElement; notePath: string; origin?: MoveOrigin };

function projectMoveOrigin(control: HTMLButtonElement): MoveOrigin | undefined {
  const panel = control.closest<HTMLElement>(TASK_PANEL_SELECTOR);
  if (panel?.dataset.section !== TASK_GROUP_KIND.project) return;
  const row = control.closest(TASK_ROW_PATH_SELECTOR);
  const nearbyRows = [row?.nextElementSibling, row?.previousElementSibling];
  return { panel, nearbyRows };
}

function focusMoveOrigin(control: HTMLButtonElement, { panel, nearbyRows }: MoveOrigin) {
  if (focusTaskControl(control, MOVE_FOCUS_OPTIONS)) return;
  for (const row of nearbyRows) {
    const arrow = row?.querySelector<HTMLButtonElement>(TASK_MOVE_CONTROL_SELECTOR);
    if (focusTaskControl(arrow, MOVE_FOCUS_OPTIONS)) return;
  }
  const disclosure = panel.querySelector<HTMLButtonElement>(PANEL_DISCLOSURE_SELECTOR);
  focusTaskControl(disclosure, MOVE_FOCUS_OPTIONS);
}

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
  showCompleted: isCompletedVisible,
  onShowCompletedChange,
  onChangePeriod,
  onOpenNote,
  onSetCompleted,
  onMoveTask,
  onReorderTask,
  onRequestCreateTask,
  onRequestRenameTask,
  onRequestTransferTask,
  onRequestArchiveTask,
  onRequestDuplicateTask,
  onCopyTaskPath,
  lastTransfer,
}: {
  document: TasksSnapshot;
  showCompleted: boolean;
  onShowCompletedChange: (visible: boolean) => void;
  onChangePeriod?: ChangePeriod;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
  onReorderTask?: ReorderTask;
  onRequestCreateTask?: RequestCreateTask;
  onRequestRenameTask?: RequestRenameTask;
  onRequestTransferTask?: RequestTransferTask;
  onRequestArchiveTask?: RequestArchiveTask;
  onRequestDuplicateTask?: TaskFromButton;
  onCopyTaskPath?: CopyTaskPath;
  lastTransfer?: TransferReceipt;
}) {
  const { period, isPeriodEditable, groups, diagnostics } = document;
  const completedToggleRef = useRef<HTMLButtonElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef<MoveFocus | null>(null);
  const diagnosticCount = diagnostics.length;
  const isDiagnosticListVisible = diagnosticCount > 0;
  const todayPanels: Panel[] = [];
  const projectPanels: Panel[] = [];
  for (const group of groups) {
    const isToday = isTodayGroup(group);
    const destination = isToday ? todayPanels : projectPanels;
    destination.push({ group, isToday });
  }
  if (!todayPanels.length)
    todayPanels.push({ group: EMPTY_TODAY, isToday: true });
  const panels = [...todayPanels, ...projectPanels];

  const moveFromButton: TaskFromButton | undefined = onMoveTask
    ? (task, control) => {
        if (hasTaskControlFocus(control)) {
          const { notePath } = task;
          moveFocus.current = { control, notePath, origin: projectMoveOrigin(control) };
        }
        void onMoveTask(task);
      }
    : undefined;

  useLayoutEffect(() => {
    const { current: pending } = moveFocus;
    if (!pending || !onMoveTask) return;
    moveFocus.current = null;

    const { control, notePath, origin } = pending;
    if (!canRestoreTaskFocus(control)) return;
    if (origin) {
      focusMoveOrigin(control, origin);
      return;
    }
    if (focusTaskControl(control)) return;

    const moveControls = panelsRef.current?.querySelectorAll<HTMLButtonElement>(
      TASK_MOVE_CONTROL_SELECTOR,
    );
    const next = Array.from(moveControls ?? []).find(
      ({ dataset: { taskPath } }) => taskPath === notePath,
    );
    if (focusTaskControl(next)) return;

    const panel = next?.closest(TASK_PANEL_SELECTOR);
    const disclosure = panel?.querySelector<HTMLButtonElement>(
      PANEL_DISCLOSURE_SELECTOR,
    );
    if (!focusTaskControl(disclosure))
      focusTaskControl(completedToggleRef.current);
  }, [document, onMoveTask]);

  function focusCompletedToggle() {
    focusTaskControl(completedToggleRef.current);
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
    return panels.map(({ group, isToday }) => {
      const { kind, link, title } = group;
      const identity = `${kind}${LIST_KEY_SEPARATOR}${link ?? title}`;
      const occurrence = occurrences.get(identity) ?? 0;
      occurrences.set(identity, occurrence + 1);
      const key = `${identity}${LIST_KEY_SEPARATOR}${occurrence}`;
      return (
        <TaskPanel
          key={key}
          group={group}
          today={isToday}
          showCompleted={isCompletedVisible}
          focusCompletedToggle={focusCompletedToggle}
          onOpenNote={onOpenNote}
          onSetCompleted={onSetCompleted}
          onMoveTask={moveFromButton}
          onReorderTask={onReorderTask}
          onRequestCreateTask={onRequestCreateTask}
          onRequestRenameTask={onRequestRenameTask}
          onRequestTransferTask={onRequestTransferTask}
          onRequestArchiveTask={onRequestArchiveTask}
          onRequestDuplicateTask={onRequestDuplicateTask}
          onCopyTaskPath={onCopyTaskPath}
          projectGroups={groups}
          lastTransfer={lastTransfer}
        />
      );
    });
  }

  return (
    <>
      <TasksToolbar
        period={period}
        isPeriodEditable={isPeriodEditable}
        onChangePeriod={onChangePeriod}
        periodSource={document}
        showCompleted={isCompletedVisible}
        onShowCompletedChange={onShowCompletedChange}
        completedToggleRef={completedToggleRef}
      />
      {isDiagnosticListVisible && renderDiagnostics()}
      <div className="pfa-task-panels" ref={panelsRef}>
        {renderPanels()}
      </div>
    </>
  );
}
