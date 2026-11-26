import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks } from "../parse-current-tasks";
import { HORIZONTAL_RULE_PATTERN } from "../parse-current-tasks.constants";
import type { ActionDiagnostic, CurrentTask, CurrentTaskGroup, CurrentTasksDocument } from "../types";
import { SECTION_GAP_OPTIONS, TASK_EDIT_COPY } from "./constants";

const { invalidList, ambiguousGroup, conflict, interleavedText } = TASK_EDIT_COPY;

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

export function markdownEndBoundary(parts: readonly string[]) {
  return Math.ceil(parts.length / 2) + 1;
}

export function assertFreeTaskGap(
  parts: readonly string[],
  start: number,
  end: number,
  { allowSectionSeparator = false } = {},
) {
  for (let line = start + 1; line < end; line++) {
    const text = parts[rowPartIndex(line)].trim();
    if (!text || (allowSectionSeparator && HORIZONTAL_RULE_PATTERN.test(text))) continue;
    throw new TaskEditError(interleavedText(line));
  }
}

export function arrangeTaskRows(parts: string[], group: CurrentTaskGroup, orderedLines: readonly number[]) {
  const { line: heading, nextHeadingLine = markdownEndBoundary(parts), tasks } = group;
  const lines = tasks.map(({ line }) => line);
  const [firstLine] = lines;
  const lastIndex = lines.length - 1;
  const lastLine = lines[lastIndex];

  if (firstLine !== undefined && firstLine !== orderedLines[0]) {
    assertFreeTaskGap(parts, heading, firstLine, SECTION_GAP_OPTIONS);
  }
  if (lastLine !== undefined && lastLine !== orderedLines[lastIndex]) {
    assertFreeTaskGap(parts, lastLine, nextHeadingLine, SECTION_GAP_OPTIONS);
  }

  const originalIndexByLine = new Map(lines.map((line, index) => [line, index]));
  let rightmostOriginalIndex = -1;

  for (const [index, line] of orderedLines.entries()) {
    const originalIndex = originalIndexByLine.get(line);
    if (originalIndex === undefined) throw new TaskEditError(conflict);
    rightmostOriginalIndex = Math.max(rightmostOriginalIndex, originalIndex);

    const originalLine = lines[index];
    const nextLine = lines[index + 1];
    const keepsNeighbors = line === originalLine && orderedLines[index + 1] === nextLine;
    //TODO: Задача из правой части в начале нового порядка означает пересечение границы.
    const crossesGap = rightmostOriginalIndex > index;
    if (nextLine === undefined || (!crossesGap && keepsNeighbors)) continue;

    assertFreeTaskGap(parts, originalLine, nextLine);
  }

  const orderedRows = orderedLines.map((line) => parts[rowPartIndex(line)]);
  lines.forEach((line, index) => {
    parts[rowPartIndex(line)] = orderedRows[index];
  });
  return parts.join("");
}
