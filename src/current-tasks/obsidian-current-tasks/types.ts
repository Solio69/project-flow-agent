import type { CurrentTask, CurrentTaskGroup, CurrentTasksDocument } from "../parse-current-tasks";

export type LinkedTask = CurrentTask & {
  notePath?: string;
  id?: string;
  project?: string;
  projectPath?: string;
};

export type LinkedTaskGroup = Omit<CurrentTaskGroup, "tasks"> & {
  notePath?: string;
  tasks: LinkedTask[];
};

export type TasksSnapshot = Omit<CurrentTasksDocument, "groups"> & {
  sourcePath: string;
  sourceMarkdown: string;
  groups: LinkedTaskGroup[];
};
