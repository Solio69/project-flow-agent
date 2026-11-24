import type { ActionsSnapshot } from "../obsidian-current-actions";
import { CURRENT_ACTIONS_STATE } from "./constants";

const { loading, error, ready } = CURRENT_ACTIONS_STATE;

type LoadingState = { kind: typeof loading };
type ReadyState = { kind: typeof ready; document: ActionsSnapshot };

export type CurrentActionsState = LoadingState | ReadyState | { kind: typeof error; message: string };

export function isKindReady(state: CurrentActionsState): state is ReadyState {
  const { kind } = state;
  return kind === ready;
}

export function isKindLoading(state: CurrentActionsState): state is LoadingState {
  const { kind } = state;
  return kind === loading;
}
