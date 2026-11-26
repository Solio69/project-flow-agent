import { VAULT_PATH_SEPARATOR, vaultParentPath } from "../../../../shared/lib/note-path";
import type { LinkedTaskGroup } from "../linked-tasks";
import { TaskEditError, type EditableTask } from "../task-edit";
import { isTodayGroup } from "../task-group";
import { TASK_TRANSFER_COPY } from "./constants";

export { TASK_TRANSFER_COPY, TASK_TRANSFER_ICON } from "./constants";
export { rewriteTransferLink, transferListRow } from "./transfer-row";

export type TransferProject = { path: string; title: string; emoji?: string };
export type TransferProjects = { owner: TransferProject; destinations: TransferProject[] };
export type TransferSelection = TransferProjects & { task: EditableTask };
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

export function taskTransferProjects(groups: LinkedTaskGroup[], taskPath: string): TransferProjects | undefined {
  const projects = groups.flatMap((group) => {
    const { notePath, title, projectEmoji: emoji } = group;
    const folder = notePath && vaultParentPath(notePath);
    return !isTodayGroup(group) && notePath && folder ? [{ path: notePath, title, emoji, folder }] : [];
  });
  const ownership = projects.filter(({ folder }) => taskPath.startsWith(folder + VAULT_PATH_SEPARATOR));
  const [owner, ambiguousOwner] = ownership;
  if (!owner || ambiguousOwner) return;
  const destinations = projects.filter(({ folder }) => folder !== owner.folder &&
    projects.filter(({ folder: candidate }) => candidate === folder).length === 1);
  return { owner, destinations };
}
