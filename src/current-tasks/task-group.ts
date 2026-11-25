import { TASK_GROUP_KIND } from "./current-tasks.constants";
import type { CurrentTaskGroup } from "./parse-current-tasks";

export function isTodayGroup({ kind }: Pick<CurrentTaskGroup, "kind">) {
  return kind === TASK_GROUP_KIND.today;
}
