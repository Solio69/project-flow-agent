import { useState } from "react";
import { PLUS_ICON } from "../../constants/icons";
import { TaskNameDialog, type TaskNameProject } from "../TaskNameDialog";
import { TASK_CREATE_COPY, TASK_CREATE_TITLE, type CreatedTaskReceipt, type CreateTask } from "../task-create";
import { CREATE_FORM_COPY } from "./constants";

export type CreateTaskProject = TaskNameProject & { path: string };
export type RequestCreateTask = (project: CreateTaskProject, control: HTMLButtonElement) => void;
const { submit, retry } = CREATE_FORM_COPY;
const { failed } = TASK_CREATE_COPY;

export function CreateTaskDialog({ project, createTask, onClose }: {
  project: CreateTaskProject;
  createTask?: CreateTask;
  onClose: (taskPath?: string) => void;
}) {
  const { path: projectPath } = project;
  const [pending, setPending] = useState<CreatedTaskReceipt>();
  const save = createTask ? async (title: string) => {
    const result = await createTask({ title, projectPath, pending });
    if (!result.ok) {
      const { pending: receipt } = result;
      setPending(receipt);
    }
    return result;
  } : undefined;

  return (
    <TaskNameDialog
      project={project}
      heading={TASK_CREATE_TITLE}
      icon={PLUS_ICON}
      submitLabel={pending ? retry : submit}
      failedMessage={failed}
      readOnly={Boolean(pending)}
      save={save}
      onClose={onClose}
    />
  );
}
