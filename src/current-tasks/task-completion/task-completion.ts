import { TASK_PATTERN, UNCHECKED_MARK } from "../parse-current-tasks.constants";
import {
  assertWritableGroup, findTaskGroup, PRESERVED_LINE_ENDING, readEditableList,
  rowPartIndex, TASK_EDIT_COPY, TaskEditError, type EditableTask, type TaskRow,
} from "../task-edit";
import type { TaskCompletionState } from "../types";
import { CHECKBOX_START, CHECKED_MARK } from "./constants";

const { conflict, interleavedText } = TASK_EDIT_COPY;

export type SetCompleted = (task: EditableTask, completed: boolean) => Promise<void>;

export function partitionTasksByCompletion<T extends TaskCompletionState>(tasks: readonly T[]) {
  const active: T[] = [];
  const completed: T[] = [];

  for (const task of tasks) {
    const destination = task.completed ? completed : active;
    destination.push(task);
  }

  return { active, completed };
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
    if (originalIndex === undefined) throw new TaskEditError(conflict);
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

export function updateCompletionMark(markdown: string, target: TaskRow, completed: boolean) {
  const { line } = target;
  const { groups, diagnostics } = readEditableList(markdown);
  const group = findTaskGroup(groups, target);
  assertWritableGroup(group, diagnostics);
  const { tasks } = group;

  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const rowIndex = rowPartIndex(line);
  const row = parts[rowIndex];
  const match = row && TASK_PATTERN.exec(row.trimEnd());
  if (!match) throw new TaskEditError(conflict);

  const [, previousMark] = match;
  if ((previousMark !== UNCHECKED_MARK) === completed) return markdown;

  const otherTasks = tasks.filter((task) => task.line !== line);
  const { active, completed: done } = partitionTasksByCompletion(otherTasks);
  const lines = tasks.map((task) => task.line);
  const orderedLines = [...active, target, ...done].map((task) => task.line);
  const affectedLine = firstAffectedTextLine(parts, lines, orderedLines);
  if (affectedLine !== undefined) throw new TaskEditError(interleavedText(affectedLine));

  const markIndex = row.indexOf(CHECKBOX_START) + CHECKBOX_START.length;
  const mark = completed ? CHECKED_MARK : UNCHECKED_MARK;
  parts[rowIndex] = row.slice(0, markIndex) + mark + row.slice(markIndex + mark.length);

  const orderedRows = orderedLines.map((orderedLine) => parts[rowPartIndex(orderedLine)]);
  lines.forEach((sourceLine, index) => {
    parts[rowPartIndex(sourceLine)] = orderedRows[index];
  });
  return parts.join("");
}
