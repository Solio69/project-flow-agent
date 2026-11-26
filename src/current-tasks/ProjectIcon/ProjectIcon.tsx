import { TRUE_STRING } from "../../constants/html-attributes";
import { Icon } from "../Icon";
import { FALLBACK_ICON } from "./constants";

export function ProjectIcon({ emoji }: { emoji?: string }) {
  if (emoji) return <span className="pfa-project-emoji" aria-hidden={TRUE_STRING}>{emoji}</span>;
  return <span className="pfa-project-icon"><Icon name={FALLBACK_ICON} /></span>;
}
