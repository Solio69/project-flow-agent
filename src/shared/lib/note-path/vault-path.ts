import { VAULT_PATH_SEPARATOR } from "./constants";

export function vaultParentPath(path: string) {
  const lastSeparator = path.lastIndexOf(VAULT_PATH_SEPARATOR);
  if (lastSeparator > 0) return path.slice(0, lastSeparator);
}
