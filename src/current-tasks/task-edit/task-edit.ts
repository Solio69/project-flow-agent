import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks } from "../parse-current-tasks";
import type { ActionDiagnostic, CurrentTask, CurrentTaskGroup, CurrentTasksDocument } from "../types";
import { TASK_EDIT_COPY } from "./constants";

const { invalidList, ambiguousGroup, conflict } = TASK_EDIT_COPY;

export type TaskRow = { line: number; link: string };
type TaskIdentity = TaskRow & { id: string; notePath: string };
export type EditableTask = CurrentTask & TaskIdentity;

export class TaskEditError extends Error {}

export function isEditableTask(task: CurrentTask & Partial<TaskIdentity>): task is EditableTask {
  const { id, link, notePath } = task;
  return Boolean(id && link && notePath);
}

export function isEditableList({ format, period, hasDuplicatePeriodFields }: CurrentTasksDocument) {
  return format === TASKS_FORMAT.properties && period !== undefined && !hasDuplicatePeriodFields;
}

export function readEditableList(markdown: string) {
  const document = parseCurrentTasks(markdown);
  if (!isEditableList(document)) throw new TaskEditError(invalidList);
  return document;
}

export function findTaskGroup(groups: readonly CurrentTaskGroup[], { line, link }: TaskRow) {
  const group = groups.find(({ tasks }) => tasks.some((task) => task.line === line && task.link === link));
  if (!group) throw new TaskEditError(conflict);
  return group;
}

export function assertWritableGroup(group: CurrentTaskGroup, diagnostics: readonly ActionDiagnostic[]) {
  const { line: groupLine, nextHeadingLine = Infinity } = group;
  const hasAmbiguousRow = diagnostics.some(({ line }) =>
    line !== undefined && line > groupLine && line < nextHeadingLine);
  if (hasAmbiguousRow) throw new TaskEditError(ambiguousGroup);
}

export function rowPartIndex(line: number): number {
  return (line - 1) * 2;
}
