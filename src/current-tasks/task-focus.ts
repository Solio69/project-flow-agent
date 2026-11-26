import { HIDDEN_SELECTOR } from "../constants/html-attributes";

export function hasTaskControlFocus(control: HTMLElement) {
  const { ownerDocument } = control;
  return ownerDocument.activeElement === control;
}

export function canRestoreTaskFocus(control: HTMLElement) {
  const { ownerDocument: { activeElement, body } } = control;
  return activeElement === control || activeElement === body;
}

export function focusTaskControl(control?: HTMLInputElement | HTMLButtonElement | null) {
  if (!control || !control.isConnected || control.disabled || control.closest(HIDDEN_SELECTOR)) return false;
  control.focus();
  return hasTaskControlFocus(control);
}
