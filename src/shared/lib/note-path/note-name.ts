import { LINK_FRAGMENT_PREFIX, MARKDOWN_EXTENSION_PATTERN, VAULT_PATH_SEPARATOR } from "./constants";

export function noteName(link: string) {
  const [path] = link.split(LINK_FRAGMENT_PREFIX, 1);
  return path.split(VAULT_PATH_SEPARATOR).pop()?.replace(MARKDOWN_EXTENSION_PATTERN, "");
}
