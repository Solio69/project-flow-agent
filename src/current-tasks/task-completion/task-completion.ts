import { TASK_PATTERN, UNCHECKED_MARK } from "../parse-current-tasks.constants";
import {
  arrangeTaskRows, assertWritableGroup, findTaskGroup, PRESERVED_LINE_ENDING, readEditableList,
  rowPartIndex, TASK_EDIT_COPY, TaskEditError, type EditableTask, type TaskRow,
} from "../task-edit";
import type { TaskCompletionState } from "../types";
import { CHECKBOX_START, CHECKED_MARK } from "./constants";

const { conflict } = TASK_EDIT_COPY;

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
  const orderedLines = [...active, target, ...done].map((task) => task.line);
  const markIndex = row.indexOf(CHECKBOX_START) + CHECKBOX_START.length;
  const mark = completed ? CHECKED_MARK : UNCHECKED_MARK;
  parts[rowIndex] = row.slice(0, markIndex) + mark + row.slice(markIndex + mark.length);

  return arrangeTaskRows(parts, group, orderedLines);
}
