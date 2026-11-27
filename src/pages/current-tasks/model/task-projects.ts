import { VAULT_PATH_SEPARATOR, vaultParentPath } from "../../../shared/lib/note-path";
import type { LinkedTaskGroup } from "./linked-tasks";
import { isTodayGroup } from "./task-group";

export type TaskProject = { path: string; title: string; emoji?: string };
export type TaskProjects = { owner: TaskProject; destinations: TaskProject[] };

export function describeTaskProjects(groups: LinkedTaskGroup[], taskPath: string): TaskProjects | undefined {
  const projects = groups.flatMap((group) => {
    const { notePath, title, projectEmoji: emoji } = group;
    const folder = notePath && vaultParentPath(notePath);
    return !isTodayGroup(group) && notePath && folder ? [{ path: notePath, title, emoji, folder }] : [];
  });
  const ownership = projects.filter(({ folder }) => taskPath.startsWith(`${folder}${VAULT_PATH_SEPARATOR}`));
  const [owner, ambiguousOwner] = ownership;
  if (!owner || ambiguousOwner) return;
  const destinations = projects.filter(({ folder }) => folder !== owner.folder &&
    projects.filter(({ folder: candidate }) => candidate === folder).length === 1);
  return { owner, destinations };
}
