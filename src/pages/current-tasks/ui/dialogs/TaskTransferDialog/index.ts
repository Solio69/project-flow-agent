import type { TransferSelection } from "../../../model/task-transfer";

export { TaskTransferDialog } from "./TaskTransferDialog";
export type RequestTransferTask = (selection: TransferSelection, control: HTMLButtonElement) => void;
