import { SPACE } from "../../constants/text";
import { TASK_GROUP_KIND } from "../current-tasks.constants";
import { TODAY_HEADING } from "../parse-current-tasks.constants";
import type { LinkedTaskGroup } from "../obsidian-current-tasks";

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
