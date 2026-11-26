import { VAULT_PATH_SEPARATOR } from "../../../shared/lib/note-path";

export function projectFolder(path: string, sourcePath: string): string | undefined {
  const parent = sourcePath.slice(
    0,
    sourcePath.lastIndexOf(VAULT_PATH_SEPARATOR) + VAULT_PATH_SEPARATOR.length,
  );
  const relative = path.startsWith(parent) ? path.slice(parent.length) : "";
  const separator = relative.indexOf(VAULT_PATH_SEPARATOR);
  if (separator !== -1) return relative.slice(0, separator);
}
