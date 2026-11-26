import {
  arrangeTaskRows,
  assertWritableGroup,
  findTaskGroup,
  PRESERVED_LINE_ENDING,
  readEditableList,
  TaskEditError,
  type EditableTask,
  type TaskRow,
} from "../task-edit";
import { ACTIVE_REORDER_REQUIRED } from "./constants";

export type ReorderTask = (task: EditableTask, destinationLine: number) => Promise<void>;

export function reorderTaskRow(markdown: string, target: TaskRow, destinationLine: number) {
  const { groups, diagnostics } = readEditableList(markdown);
  const group = findTaskGroup(groups, target);
  assertWritableGroup(group, diagnostics);

  const { line: targetLine } = target;
  const { tasks } = group;
  const activeLines = tasks.filter(({ completed }) => !completed).map(({ line }) => line);
  const from = activeLines.indexOf(targetLine);
  const to = activeLines.indexOf(destinationLine);
  if (from < 0 || to < 0) throw new TaskEditError(ACTIVE_REORDER_REQUIRED);
  if (from === to) return markdown;

  activeLines.splice(from, 1);
  activeLines.splice(to, 0, targetLine);
  let activeIndex = 0;
  const orderedLines = tasks.map(({ line, completed }) => completed ? line : activeLines[activeIndex++]);
  return arrangeTaskRows(markdown.split(PRESERVED_LINE_ENDING), group, orderedLines);
}
