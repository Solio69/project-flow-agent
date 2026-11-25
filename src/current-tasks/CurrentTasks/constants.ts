import { STATUS_ROLE } from "../../constants/html-attributes";

export const CURRENT_TASKS_STATE = { loading: "loading", error: "error", ready: "ready" } as const;
export const LOADING_STATUS = { role: STATUS_ROLE, message: "Читаю заметку…" } as const;
