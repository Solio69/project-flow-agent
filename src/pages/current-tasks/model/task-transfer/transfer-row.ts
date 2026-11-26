import {
  assertWritableGroup,
  findTaskGroup,
  readEditableList,
  TASK_EDIT_COPY,
  TaskEditError,
  type TaskRow,
} from "../task-edit";
import { isTodayGroup } from "../task-group";
import { moveTaskRow } from "../task-move";

const { conflict } = TASK_EDIT_COPY;

export function transferListRow(
  markdown: string,
  task: TaskRow,
  destinationLine: number,
) {
  const { groups, diagnostics } = readEditableList(markdown);
  const origin = findTaskGroup(groups, task);
  if (isTodayGroup(origin) || origin.line === destinationLine) {
    assertWritableGroup(origin, diagnostics);
    return markdown;
  }
  const destination = groups.find(({ line }) => line === destinationLine);
  const selected = origin.tasks.find(({ line }) => line === task.line);
  if (!destination || !selected) throw new TaskEditError(conflict);
  const { tasks, line: headingLine } = destination;
  const { completed: isSelectedCompleted } = selected;
  let afterLine = headingLine;
  for (const { line, completed: isCompleted } of tasks) {
    if (isSelectedCompleted || !isCompleted) afterLine = line;
  }
  return moveTaskRow(
    markdown,
    task,
    { headingLine, afterLine },
    { allowCompleted: true },
  );
}
