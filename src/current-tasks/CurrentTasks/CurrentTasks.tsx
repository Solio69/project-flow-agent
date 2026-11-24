import { TasksList } from "../TasksList";
import type { OpenNote } from "../NoteLink";
import { ERROR_ROLE, LOADING_STATUS } from "./constants";
import { isKindLoading, isKindReady, type CurrentTasksState } from "./state";

export function CurrentTasks({ title, state, onOpenNote }: {
  title: string;
  state: CurrentTasksState;
  onOpenNote: OpenNote;
}) {
  function renderContent() {
    if (isKindReady(state)) {
      const { document } = state;
      return <TasksList document={document} onOpenNote={onOpenNote} />;
    }

    const { role, message } = isKindLoading(state)
      ? LOADING_STATUS
      : { role: ERROR_ROLE, message: state.message };
    return <p role={role}>{message}</p>;
  }

  return (
    <section className="pfa-current-tasks">
      <h2>{title}</h2>
      {renderContent()}
    </section>
  );
}
