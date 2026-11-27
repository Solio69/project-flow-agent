import type { App } from "obsidian";
import type { TasksSnapshot } from "../model/linked-tasks";
import { TASK_EDIT_COPY, TaskEditError } from "../model/task-edit";
import { updateTaskPeriod } from "../model/task-period";
import type { TaskPeriod } from "../model/types";
import { assertCurrentSource, requireSource } from "./source-note";

const { conflict } = TASK_EDIT_COPY;

export async function changeTaskPeriod(app: App, { sourcePath, sourceMarkdown }: TasksSnapshot, period?: TaskPeriod) {
  const { vault } = app;
  const source = requireSource(app, sourcePath);
  const nextMarkdown = updateTaskPeriod(sourceMarkdown, period);
  const saved = await vault.process(source, (current) => {
    assertCurrentSource(app, source, sourcePath);
    if (current !== sourceMarkdown && current !== nextMarkdown) throw new TaskEditError(conflict);
    return nextMarkdown;
  });
  if (saved !== nextMarkdown) throw new TaskEditError(conflict);
}
