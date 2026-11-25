import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks } from "../parse-current-tasks";
import { TASK_PATTERN, UNCHECKED_MARK } from "../parse-current-tasks.constants";
import type { CurrentTask, TaskCompletionState } from "../types";
import { CHECKBOX_START, CHECKED_MARK, COPY, PRESERVED_LINE_ENDING } from "./constants";

const { invalidList, conflict, ambiguousGroup, interleavedText } = COPY;

type CompletionRow = { line: number; link: string };
type CompletionIdentity = CompletionRow & { id: string; notePath: string };
export type CompletionTarget = CurrentTask & CompletionIdentity;
export type SetCompleted = (task: CompletionTarget, completed: boolean) => Promise<void>;

export class TaskCompletionError extends Error {}

export function isCompletionTarget(task: CurrentTask & Partial<CompletionIdentity>): task is CompletionTarget {
  const { id, link, notePath } = task;
  return Boolean(id && link && notePath);
}

export function partitionTasksByCompletion<T extends TaskCompletionState>(tasks: readonly T[]) {
  const active: T[] = [];
  const completed: T[] = [];

  for (const task of tasks) {
    const destination = task.completed ? completed : active;
    destination.push(task);
  }

  return { active, completed };
}

function rowPartIndex(line: number): number {
  return (line - 1) * 2;
}

function firstAffectedTextLine(
  parts: readonly string[],
  lines: readonly number[],
  orderedLines: readonly number[],
): number | undefined {
  const originalIndexByLine = new Map(lines.map((line, index) => [line, index]));
  let rightmostOriginalIndex = -1;

  for (const [index, line] of orderedLines.entries()) {
    const originalIndex = originalIndexByLine.get(line);
    if (originalIndex === undefined) throw new TaskCompletionError(conflict);
    rightmostOriginalIndex = Math.max(rightmostOriginalIndex, originalIndex);

    const originalLine = lines[index];
    const nextLine = lines[index + 1];
    const keepsNeighbors = line === originalLine && orderedLines[index + 1] === nextLine;
    //TODO: Задача из правой части в префиксе списка означает пересечение этой границы.
    const crossesGap = rightmostOriginalIndex > index;
    if (nextLine === undefined || (!crossesGap && keepsNeighbors)) continue;

    for (let gap = originalLine + 1; gap < nextLine; gap++) {
      if (parts[rowPartIndex(gap)].trim()) return gap;
    }
  }
}

export function updateCompletionMark(markdown: string, target: CompletionRow, completed: boolean) {
  const { line, link } = target;
  const { format, period, groups, diagnostics } = parseCurrentTasks(markdown);
  if (format !== TASKS_FORMAT.properties || !period) throw new TaskCompletionError(invalidList);

  const group = groups.find(({ tasks }) => tasks.some((task) => task.line === line && task.link === link));
  if (!group) throw new TaskCompletionError(conflict);

  const { line: groupLine, nextHeadingLine = Infinity, tasks } = group;
  const hasAmbiguousRow = diagnostics.some(({ line: problemLine }) =>
    problemLine !== undefined && problemLine > groupLine && problemLine < nextHeadingLine);
  if (hasAmbiguousRow) throw new TaskCompletionError(ambiguousGroup);

  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const rowIndex = rowPartIndex(line);
  const row = parts[rowIndex];
  const match = row && TASK_PATTERN.exec(row.trimEnd());
  if (!match) throw new TaskCompletionError(conflict);

  const [, previousMark] = match;
  if ((previousMark !== UNCHECKED_MARK) === completed) return markdown;

  const otherTasks = tasks.filter((task) => task.line !== line);
  const { active, completed: done } = partitionTasksByCompletion(otherTasks);
  const lines = tasks.map((task) => task.line);
  const orderedLines = [...active, target, ...done].map((task) => task.line);
  const affectedLine = firstAffectedTextLine(parts, lines, orderedLines);
  if (affectedLine !== undefined) throw new TaskCompletionError(interleavedText(affectedLine));

  const markIndex = row.indexOf(CHECKBOX_START) + CHECKBOX_START.length;
  const mark = completed ? CHECKED_MARK : UNCHECKED_MARK;
  parts[rowIndex] = row.slice(0, markIndex) + mark + row.slice(markIndex + mark.length);

  const orderedRows = orderedLines.map((orderedLine) => parts[rowPartIndex(orderedLine)]);
  lines.forEach((sourceLine, index) => {
    parts[rowPartIndex(sourceLine)] = orderedRows[index];
  });
  return parts.join("");
}
