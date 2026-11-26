import { useState } from "react";
import { noteName } from "../../../../../shared/lib/note-path";
import { TaskNameDialog, type TaskNameProject } from "../TaskNameDialog";
import type { EditableTask } from "../../../model/task-edit";
import { TASK_RENAME_COPY, TASK_RENAME_ICON, TASK_RENAME_TITLE, type RenameTask } from "../../../model/task-rename";

const { failed } = TASK_RENAME_COPY;

export type RenameSelection = { task: EditableTask; project: TaskNameProject; sourceMarkdown: string };
export type RequestRenameTask = (task: EditableTask, project: TaskNameProject, control: HTMLButtonElement) => void;

export function RenameTaskDialog({ selection: { task, project, sourceMarkdown }, renameTask, onClose }: {
  selection: RenameSelection;
  renameTask?: RenameTask;
  onClose: () => void;
}) {
  const { notePath } = task;
  const [confirmedSource, setConfirmedSource] = useState(sourceMarkdown);
  const save = renameTask ? async (title: string) => {
    const result = await renameTask({ title, task, sourceMarkdown: confirmedSource });
    if (!result.ok) {
      const { latestSourceMarkdown } = result;
      if (latestSourceMarkdown !== undefined) setConfirmedSource(latestSourceMarkdown);
    }
    return result;
  } : undefined;

  return (
    <TaskNameDialog
      project={project}
      heading={TASK_RENAME_TITLE}
      icon={TASK_RENAME_ICON}
      initialTitle={noteName(notePath)}
      failedMessage={failed}
      save={save}
      onClose={onClose}
    />
  );
}
