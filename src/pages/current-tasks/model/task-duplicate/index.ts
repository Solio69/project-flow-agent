import { EMPTY_STRING } from "../../../../shared/lib";
import { TASK_TITLE_LIMIT } from "../task-create";
import type { EditableTask } from "../task-edit";
import { EXISTING_COPY_SUFFIX, FIRST_COPY, FIRST_COPY_NUMBER, NUMBERED_COPY } from "./constants";

export { DUPLICATE_TASK_COPY, DUPLICATE_TASK_ICON, FIRST_COPY_NUMBER } from "./constants";
export type DuplicateTask = (task: EditableTask) => Promise<string | undefined>;

export function copyTitle(original: string, number: number) {
  const suffix = number === FIRST_COPY_NUMBER ? FIRST_COPY : NUMBERED_COPY(number);
  const base = original.replace(EXISTING_COPY_SUFFIX, EMPTY_STRING);
  return `${base.slice(0, TASK_TITLE_LIMIT - suffix.length).trimEnd()}${suffix}`;
}
