import { SPACE } from "../../../../shared/lib";
import { TASK_GROUP_KIND } from "../../model/current-tasks.constants";
import { TODAY_HEADING } from "../../model/parse-current-tasks.constants";
import type { LinkedTaskGroup } from "../../model/linked-tasks";

export const DIAGNOSTIC_LABEL_SUFFIX = "." + SPACE;
export const TASK_MOVE_CONTROL_SELECTOR = "button[data-task-path]";

export const COPY = {
  diagnosticsTitle: "Замечания к заметке",
  lineLabel: "Строка",
};

export const EMPTY_TODAY: LinkedTaskGroup = {
  kind: TASK_GROUP_KIND.today,
  line: 0,
  title: TODAY_HEADING,
  tasks: [],
};
