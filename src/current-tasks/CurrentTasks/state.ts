import type { TasksSnapshot } from "../obsidian-current-tasks";
import { CURRENT_TASKS_STATE } from "./constants";

const { loading, error, ready } = CURRENT_TASKS_STATE;

type LoadingState = { kind: typeof loading };
type ReadyState = { kind: typeof ready; document: TasksSnapshot };

export type CurrentTasksState = LoadingState | ReadyState | { kind: typeof error; message: string };

export function isKindReady(state: CurrentTasksState): state is ReadyState {
  const { kind } = state;
  return kind === ready;
}

export function isKindLoading(state: CurrentTasksState): state is LoadingState {
  const { kind } = state;
  return kind === loading;
}
