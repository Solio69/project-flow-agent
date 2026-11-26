import { TASK_EDIT_COPY, TaskEditError } from "../task-edit";

export { TASK_RENAME_COPY, TASK_RENAME_ICON, TASK_RENAME_TITLE } from "./constants";

const { conflict } = TASK_EDIT_COPY;

type RenameTaskIdentity = { id: string; notePath: string };
export type RenameTaskRequest = { task: RenameTaskIdentity; title: string; sourceMarkdown: string };
export type RenameTaskResult =
  | { ok: true; taskPath: string }
  | { ok: false; message: string; latestSourceMarkdown?: string };
export type RenameTask = (request: RenameTaskRequest) => Promise<RenameTaskResult>;

export class RenameTaskSourceChanged extends TaskEditError {
  constructor(readonly sourceMarkdown: string) {
    super(conflict);
  }
}
