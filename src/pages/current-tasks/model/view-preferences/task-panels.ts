import { LIST_KEY_SEPARATOR } from "../current-tasks.constants";
import type { LinkedTaskGroup } from "../linked-tasks";
import { isTodayGroup } from "../task-group";

type TaskPanel = { group: LinkedTaskGroup; isToday: boolean; key: string };
type ProjectPanel = TaskPanel & { legacyKey: string };

function nextOccurrence(occurrences: Map<string, number>, key: string) {
  const occurrence = occurrences.get(key) ?? 0;
  occurrences.set(key, occurrence + 1);
  return occurrence;
}

export function collectTaskPanels(groups: readonly LinkedTaskGroup[]) {
  const todayPanels: TaskPanel[] = [];
  const projectPanels: ProjectPanel[] = [];
  const legacyOccurrences = new Map<string, number>();
  const projectOccurrences = new Map<string, number>();

  for (const group of groups) {
    const { kind, notePath, link, title } = group;
    const identity = notePath ?? link ?? title;
    const legacyIdentity = `${kind}${LIST_KEY_SEPARATOR}${identity}`;
    const legacyOccurrence = nextOccurrence(legacyOccurrences, legacyIdentity);
    const legacyKey = legacyOccurrence ? JSON.stringify([identity, legacyOccurrence]) : identity;
    const isToday = isTodayGroup(group);
    if (isToday) {
      todayPanels.push({ group, isToday, key: legacyKey });
      continue;
    }

    const headingKey = JSON.stringify([identity, title]);
    const occurrence = nextOccurrence(projectOccurrences, headingKey);
    const key = occurrence ? JSON.stringify([identity, title, occurrence]) : headingKey;
    projectPanels.push({ group, isToday, key, legacyKey });
  }

  return { todayPanels, projectPanels };
}
