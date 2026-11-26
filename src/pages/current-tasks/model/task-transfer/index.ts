import { TaskEditError, type EditableTask } from "../task-edit";
import type { TaskProjects } from "../task-projects";
import { TASK_TRANSFER_COPY } from "./constants";

export { TASK_TRANSFER_COPY, TASK_TRANSFER_ICON } from "./constants";
export { transferListRow } from "./transfer-row";

export type TransferSelection = TaskProjects & { task: EditableTask };
export type TransferReceipt = { taskPath: string; projectPath: string };
export type TransferTaskRequest = { task: EditableTask; projectPath: string; pending?: TransferReceipt };
export type TransferTaskResult =
  | { ok: true; taskPath: string }
  | { ok: false; message: string; pending?: TransferReceipt };
export type TransferTask = (request: TransferTaskRequest) => Promise<TransferTaskResult>;

const { partial } = TASK_TRANSFER_COPY;

export class PartialTaskTransfer extends TaskEditError {
  constructor(readonly receipt: TransferReceipt) {
    super(partial(receipt.taskPath));
  }
}
