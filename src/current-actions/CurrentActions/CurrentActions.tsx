import { ActionsList } from "../ActionsList";
import type { OpenNote } from "../NoteLink";
import { ERROR_ROLE, LOADING_STATUS } from "./constants";
import { isKindLoading, isKindReady, type CurrentActionsState } from "./state";

export function CurrentActions({ title, state, onOpenNote }: {
  title: string;
  state: CurrentActionsState;
  onOpenNote: OpenNote;
}) {
  function renderContent() {
    if (isKindReady(state)) {
      const { document } = state;
      return <ActionsList document={document} onOpenNote={onOpenNote} />;
    }

    const { role, message } = isKindLoading(state)
      ? LOADING_STATUS
      : { role: ERROR_ROLE, message: state.message };
    return <p role={role}>{message}</p>;
  }

  return (
    <section className="pfa-current-actions">
      <h2>{title}</h2>
      {renderContent()}
    </section>
  );
}
