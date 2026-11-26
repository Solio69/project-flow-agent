import { useState } from "react";
import { ALERT_ROLE } from "../../constants/html-attributes";
import { TasksList } from "../TasksList";
import type { OpenNote } from "../NoteLink";
import type { SetCompleted } from "../task-completion";
import type { MoveTask } from "../task-move";
import { LOADING_STATUS } from "./constants";
import { isKindLoading, isKindReady, type CurrentTasksState } from "./state";

export function CurrentTasks({ title, state, onOpenNote, onSetCompleted, onMoveTask }: {
  title: string;
  state: CurrentTasksState;
  onOpenNote: OpenNote;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
}) {
  const [showCompleted, setShowCompleted] = useState(true);

  function renderContent() {
    if (isKindReady(state)) {
      const { document } = state;
      return (
        <TasksList
          document={document}
          showCompleted={showCompleted}
          onShowCompletedChange={setShowCompleted}
          onOpenNote={onOpenNote}
          onSetCompleted={onSetCompleted}
          onMoveTask={onMoveTask}
        />
      );
    }

    const { role, message } = isKindLoading(state)
      ? LOADING_STATUS
      : { role: ALERT_ROLE, message: state.message };
    return <p className="pfa-view-message" role={role}>{message}</p>;
  }

  return (
    <section className="pfa-current-tasks">
      <header className="pfa-page-heading"><h2>{title}</h2></header>
      {renderContent()}
    </section>
  );
}
