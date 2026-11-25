import { TASK_GROUP_KIND } from "./current-tasks.constants";
import type { TaskGroupKind } from "./types";

export function isTodayGroup({ kind }: { kind: TaskGroupKind }) {
  return kind === TASK_GROUP_KIND.today;
}
