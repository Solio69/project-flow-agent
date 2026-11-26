import type { CurrentTask, CurrentTaskGroup, CurrentTasksDocument } from "./types";

export type LinkedTask = CurrentTask & {
  notePath?: string;
  id?: string;
  project?: string;
  projectPath?: string;
  projectEmoji?: string;
};

export interface LinkedTaskGroup extends CurrentTaskGroup<LinkedTask> {
  notePath?: string;
  projectEmoji?: string;
}

export interface TasksSnapshot extends CurrentTasksDocument<LinkedTaskGroup> {
  sourcePath: string;
  sourceMarkdown: string;
}
