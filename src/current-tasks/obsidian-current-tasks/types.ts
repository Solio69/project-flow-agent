import type { CurrentTask, CurrentTaskGroup, CurrentTasksDocument } from "../types";

export type LinkedTask = CurrentTask & {
  notePath?: string;
  id?: string;
  project?: string;
  projectPath?: string;
};

export interface LinkedTaskGroup extends CurrentTaskGroup<LinkedTask> {
  notePath?: string;
}

export interface TasksSnapshot extends CurrentTasksDocument<LinkedTaskGroup> {
  sourcePath: string;
  sourceMarkdown: string;
}
