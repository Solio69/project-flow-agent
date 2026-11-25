import { setIcon, type IconName } from "obsidian";
import { useCallback } from "react";
import { TRUE_STRING } from "../../constants/html-attributes";

export function Icon({ name }: { name: IconName }) {
  const attach = useCallback((element: HTMLSpanElement | null) => {
    if (element) setIcon(element, name);
  }, [name]);

  return <span className="pfa-icon" ref={attach} aria-hidden={TRUE_STRING} />;
}
