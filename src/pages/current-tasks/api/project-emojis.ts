import type { Vault } from "obsidian";
import { VAULT_PATH_SEPARATOR, vaultParentPath } from "../../../shared/lib/note-path";
import { isRecord, isString } from "../../../shared/lib";
import { CONTAINS_EMOJI, EMOJI_SEQUENCE, ICONIZE_DATA_PATH } from "./project-emojis.constants";

function configuredEmoji(value: unknown): string | undefined {
  const icon = isRecord(value) ? value.iconName : value;
  if (isString(icon) && CONTAINS_EMOJI.test(icon) && EMOJI_SEQUENCE.test(icon)) return icon;
}

export async function readProjectEmojis({ configDir, adapter }: Vault) {
  const path = `${configDir}${VAULT_PATH_SEPARATOR}${ICONIZE_DATA_PATH}`;
  try {
    const data: unknown = JSON.parse(await adapter.read(path));
    return isRecord(data) ? data : undefined;
  } catch {
    //TODO: Iconize необязателен. При отсутствии настроек показываем значок папки.
  }
}

export function emojiForProject(data: Record<string, unknown> | undefined, path: string) {
  const parent = vaultParentPath(path);
  const parentIcon = parent ? data?.[parent] : undefined;
  return configuredEmoji(data?.[path]) ?? configuredEmoji(parentIcon);
}
