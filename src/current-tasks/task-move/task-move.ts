import { HORIZONTAL_RULE_PATTERN } from "../parse-current-tasks.constants";
import {
  assertWritableGroup, findTaskGroup, PRESERVED_LINE_ENDING, readEditableList,
  rowPartIndex, TASK_EDIT_COPY, TaskEditError, type EditableTask, type TaskRow,
} from "../task-edit";
import { TASK_MOVE_COPY } from "./constants";

const { conflict, interleavedText } = TASK_EDIT_COPY;
const { activeTaskRequired } = TASK_MOVE_COPY;

export type MoveTask = (task: EditableTask) => Promise<void>;

type MoveDestination = { headingLine: number; afterLine: number };

function assertFreeGap(parts: readonly string[], start: number, end: number) {
  for (let current = start + 1; current < end; current++) {
    const text = parts[rowPartIndex(current)].trim();
    if (text && !HORIZONTAL_RULE_PATTERN.test(text)) throw new TaskEditError(interleavedText(current));
  }
}

export function moveTaskRow(markdown: string, task: TaskRow, { headingLine, afterLine }: MoveDestination) {
  const { groups, diagnostics } = readEditableList(markdown);
  const origin = findTaskGroup(groups, task);
  const destination = groups.find(({ line }) => line === headingLine);
  if (!destination || destination === origin) throw new TaskEditError(conflict);

  assertWritableGroup(origin, diagnostics);
  assertWritableGroup(destination, diagnostics);

  const { line } = task;
  const { line: originHeading, nextHeadingLine: nextOriginHeading, tasks: originTasks } = origin;
  const { nextHeadingLine: nextDestinationHeading, tasks: destinationTasks } = destination;
  const selectedIndex = originTasks.findIndex(({ line: rowLine }) => rowLine === line);
  const selected = originTasks[selectedIndex];
  if (!selected) throw new TaskEditError(conflict);
  if (selected.completed) throw new TaskEditError(activeTaskRequired);

  const anchorIndex = destinationTasks.findIndex(({ line: rowLine, completed }) => rowLine === afterLine && !completed);
  if (afterLine !== headingLine && anchorIndex === -1) throw new TaskEditError(conflict);

  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const endOfDocument = Math.ceil(parts.length / 2) + 1;
  const beforeSelected = originTasks[selectedIndex - 1]?.line ?? originHeading;
  const afterSelected = originTasks[selectedIndex + 1]?.line ?? nextOriginHeading ?? endOfDocument;
  const afterInsertion = destinationTasks[anchorIndex + 1]?.line ?? nextDestinationHeading ?? endOfDocument;
  assertFreeGap(parts, beforeSelected, line);
  assertFreeGap(parts, line, afterSelected);
  assertFreeGap(parts, afterLine, afterInsertion);

  const rowIndex = rowPartIndex(line);
  const insertionIndex = rowPartIndex(afterLine) + 1;
  const removalIndex = rowIndex === parts.length - 1 ? rowIndex - 1 : rowIndex;
  const row = parts[rowIndex];
  const newLine = parts[insertionIndex] ?? parts[insertionIndex - 2];
  if (!newLine) throw new TaskEditError(conflict);

  if (removalIndex < insertionIndex) {
    parts.splice(insertionIndex, 0, newLine, row);
    parts.splice(removalIndex, 2);
  } else {
    parts.splice(removalIndex, 2);
    parts.splice(insertionIndex, 0, newLine, row);
  }
  return parts.join("");
}
