import type { ArchiveSelection } from "../../../model/task-archive";

export { TaskArchiveDialog } from "./TaskArchiveDialog";
export type RequestArchiveTask = (selection: ArchiveSelection, control: HTMLButtonElement) => void;
