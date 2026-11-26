import { isBoolean, isRecord } from "../../../shared/lib";
import { DEFAULT_SHOW_COMPLETED, SHOW_COMPLETED_SETTING } from "./completed-visibility.constants";

type VisibilityListener = () => void;
type PluginSettings = Record<string, unknown>;

export type CompletedVisibility = {
  get: () => boolean;
  set: (visible: boolean) => Promise<void>;
  subscribe: (listener: VisibilityListener) => () => void;
};

export function createCompletedVisibility(
  data: unknown,
  save: (settings: PluginSettings) => Promise<void>,
  onSaveError: (error: unknown) => void,
): CompletedVisibility {
  const settings: PluginSettings = isRecord(data) ? { ...data } : {};
  const { [SHOW_COMPLETED_SETTING]: savedVisibility } = settings;
  let visible = isBoolean(savedVisibility) ? savedVisibility : DEFAULT_SHOW_COMPLETED;
  let pendingSave = Promise.resolve();
  const listeners = new Set<VisibilityListener>();

  return {
    get: () => visible,
    set(next) {
      if (next === visible) return pendingSave;

      visible = next;
      const snapshot = { ...settings, [SHOW_COMPLETED_SETTING]: next };
      const saved = pendingSave.then(() => save(snapshot)).catch(onSaveError);
      pendingSave = saved;
      for (const listener of listeners) listener();
      return saved;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
