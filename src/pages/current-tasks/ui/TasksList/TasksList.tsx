import { useLayoutEffect, useRef, type RefObject } from "react";
import { SPACE } from "../../../../shared/lib";
import { FOCUS_WITHOUT_SCROLL } from "../../../../shared/lib/dom";
import type { RequestCreateTask } from "../dialogs/CreateTaskDialog";
import type { OpenNote } from "../NoteLink";
import type { RequestRenameTask } from "../dialogs/RenameTaskDialog";
import type { TaskFromButton } from "../Task";
import { TaskPanel } from "../TaskPanel";
import { TasksToolbar } from "../TasksToolbar";
import { LIST_KEY_SEPARATOR } from "../../model/current-tasks.constants";
import type { TasksSnapshot } from "../../model/linked-tasks";
import type { SetCompleted } from "../../model/task-completion";
import {
  canRestoreTaskFocus,
  focusTaskControl,
  focusTaskElement,
  hasTaskControlFocus,
} from "../task-focus";
import {
  PANEL_DISCLOSURE_SELECTOR,
  PANEL_TITLE_SELECTOR,
  TASK_PANEL_SELECTOR,
  TASK_ROW_PATH_SELECTOR,
} from "../task-focus.constants";
import type { MoveTask } from "../../model/task-move";
import type { CopyTaskPath } from "../../model/task-note-path";
import type { ChangePeriod } from "../../model/task-period";
import type { ReorderTask } from "../../model/task-reorder";
import type { TransferReceipt } from "../../model/task-transfer";
import { collectTaskPanels, type SetCompletedVisible, type SetProjectsCollapsed } from "../../model/view-preferences";
import type { RequestTransferTask } from "../dialogs/TaskTransferDialog";
import type { RequestArchiveTask } from "../dialogs/TaskArchiveDialog";
import type { ActionDiagnostic } from "../../model/types";
import {
  COPY,
  DIAGNOSTIC_LABEL_SUFFIX,
  EMPTY_TODAY,
  TASK_MOVE_CONTROL_SELECTOR,
} from "./constants";

const { diagnosticsTitle, lineLabel } = COPY;

type MoveFocus = { control: HTMLButtonElement; panel: HTMLElement; nearbyRows: (Element | null | undefined)[] };

function captureMoveFocus(control: HTMLButtonElement): MoveFocus | null {
  const panel = control.closest<HTMLElement>(TASK_PANEL_SELECTOR);
  if (!panel) return null;
  const row = control.closest(TASK_ROW_PATH_SELECTOR);
  const nearbyRows = [row?.nextElementSibling, row?.previousElementSibling];
  return { control, panel, nearbyRows };
}

function restoreMoveFocus({ control, panel, nearbyRows }: MoveFocus) {
  if (!canRestoreTaskFocus(control)) return;
  if (focusTaskControl(control, FOCUS_WITHOUT_SCROLL)) return;
  for (const row of nearbyRows) {
    const arrow = row?.querySelector<HTMLButtonElement>(TASK_MOVE_CONTROL_SELECTOR);
    if (focusTaskControl(arrow, FOCUS_WITHOUT_SCROLL)) return;
  }
  const title = panel.querySelector<HTMLHeadingElement>(PANEL_TITLE_SELECTOR);
  const disclosure = title?.parentElement?.querySelector<HTMLButtonElement>(PANEL_DISCLOSURE_SELECTOR);
  if (!focusTaskControl(disclosure, FOCUS_WITHOUT_SCROLL))
    focusTaskElement(title, FOCUS_WITHOUT_SCROLL);
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
  panelsRef,
  showCompleted: isCompletedVisible,
  onShowCompletedChange,
  collapsedProjects,
  onProjectsCollapsed,
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
  panelsRef: RefObject<HTMLDivElement | null>;
  showCompleted: boolean;
  onShowCompletedChange: SetCompletedVisible;
  collapsedProjects: ReadonlySet<string>;
  onProjectsCollapsed: SetProjectsCollapsed;
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
  const moveFocus = useRef<MoveFocus | null>(null);
  const revealedTransfer = useRef<TransferReceipt | undefined>(undefined);
  const diagnosticCount = diagnostics.length;
  const isDiagnosticListVisible = diagnosticCount > 0;
  const { todayPanels, projectPanels } = collectTaskPanels(groups);
  if (!todayPanels.length)
    todayPanels.push({ group: EMPTY_TODAY, isToday: true, key: EMPTY_TODAY.title });
  const panels = [...todayPanels, ...projectPanels];
  const projectKeys = projectPanels.map(({ key }) => key);
  const isAnyProjectExpanded = projectKeys.some((key) => !collapsedProjects.has(key));
  const toggleProjects = projectKeys.length
    ? () => void onProjectsCollapsed(projectKeys, isAnyProjectExpanded)
    : undefined;

  useLayoutEffect(() => {
    if (!lastTransfer || revealedTransfer.current === lastTransfer) return;
    const { projectPath, taskPath } = lastTransfer;
    const destination = projectPanels.find(({ group: { notePath, tasks } }) => {
      if (notePath !== projectPath) return false;
      return tasks.some(({ notePath: currentPath }) => currentPath === taskPath);
    });
    if (!destination) return;
    revealedTransfer.current = lastTransfer;
    const { key } = destination;
    void onProjectsCollapsed([key], false);
  }, [projectPanels, lastTransfer, onProjectsCollapsed]);

  const moveFromButton: TaskFromButton | undefined = onMoveTask
    ? (task, control) => {
        moveFocus.current = hasTaskControlFocus(control) ? captureMoveFocus(control) : null;
        void onMoveTask(task);
      }
    : undefined;

  useLayoutEffect(() => {
    const { current: pending } = moveFocus;
    if (!pending || !onMoveTask) return;
    moveFocus.current = null;
    restoreMoveFocus(pending);
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
    return panels.map(({ group, isToday, key }) => {
      const { kind } = group;
      const reactKey = `${kind}${LIST_KEY_SEPARATOR}${key}`;
      const isExpanded = isToday || !collapsedProjects.has(key);
      return (
        <TaskPanel
          key={reactKey}
          group={group}
          today={isToday}
          isExpanded={isExpanded}
          onToggleProject={() => void onProjectsCollapsed([key], isExpanded)}
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
        isAnyProjectExpanded={isAnyProjectExpanded}
        onToggleProjects={toggleProjects}
      />
      {isDiagnosticListVisible && renderDiagnostics()}
      <div className="pfa-task-panels" ref={panelsRef}>
        {renderPanels()}
      </div>
    </>
  );
}
