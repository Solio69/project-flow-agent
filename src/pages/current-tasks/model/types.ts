import type { TASK_GROUP_KIND, TASKS_FORMAT } from "./current-tasks.constants";

export type TasksFormat = (typeof TASKS_FORMAT)[keyof typeof TASKS_FORMAT];
export type TaskGroupKind = (typeof TASK_GROUP_KIND)[keyof typeof TASK_GROUP_KIND];
export type TaskPeriod = { start: string; end: string };
export type TaskCompletionState = { completed: boolean };

export interface ActionDiagnostic {
  line?: number;
  message: string;
}

export interface CurrentTask extends TaskCompletionState {
  line: number;
  title: string;
  link?: string;
}

export interface CurrentTaskGroup<Task extends CurrentTask = CurrentTask> {
  kind: TaskGroupKind;
  line: number;
  nextHeadingLine?: number;
  title: string;
  link?: string;
  tasks: Task[];
}

export interface CurrentTasksDocument<Group extends CurrentTaskGroup = CurrentTaskGroup> {
  format: TasksFormat;
  period?: TaskPeriod;
  hasDuplicatePeriodFields: boolean;
  groups: Group[];
  diagnostics: ActionDiagnostic[];
}
