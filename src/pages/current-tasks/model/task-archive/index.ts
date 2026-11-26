import { TaskEditError, type EditableTask } from "../task-edit";
import type { TaskProject } from "../task-projects";
import { TASK_ARCHIVE_COPY } from "./constants";

export { archiveListRow } from "./archive-row";
export { PROJECT_ARCHIVE, TASK_ARCHIVE_COPY, TASK_ARCHIVE_ICON } from "./constants";

export type ArchiveSelection = { task: EditableTask; owner: TaskProject };
export type ArchiveReceipt = { taskPath: string };
export type ArchiveTaskRequest = { task: EditableTask; pending?: ArchiveReceipt };
export type ArchiveTaskResult =
  | { ok: true; taskPath: string }
  | { ok: false; message: string; pending?: ArchiveReceipt };
export type ArchiveTask = (request: ArchiveTaskRequest) => Promise<ArchiveTaskResult>;

const { partial } = TASK_ARCHIVE_COPY;

export class PartialTaskArchive extends TaskEditError {
  constructor(readonly receipt: ArchiveReceipt) {
    super(partial(receipt.taskPath));
  }
}
