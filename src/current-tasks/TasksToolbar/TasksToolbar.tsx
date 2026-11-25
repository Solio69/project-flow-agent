import { Icon } from "../Icon";
import { PreviewAction } from "../PreviewAction";
import type { CurrentTasksDocument } from "../parse-current-tasks";
import { COPY, DAY, DAY_MONTH, FULL_DATE, ICONS } from "./constants";

const { noPeriod, periodLabel, historyLabel } = COPY;
const { calendar, history } = ICONS;

function periodText({ start, end }: NonNullable<CurrentTasksDocument["period"]>): string {
  const first = new Date(start);
  const last = new Date(end);
  if (start === end) return DAY_MONTH.format(first);

  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const sameMonth = sameYear && first.getUTCMonth() === last.getUTCMonth();
  if (sameMonth) return `${DAY.format(first)}–${DAY_MONTH.format(last)}`;

  const display = sameYear ? DAY_MONTH : FULL_DATE;
  return `${display.format(first)} — ${display.format(last)}`;
}

export function TasksToolbar({ period }: { period: CurrentTasksDocument["period"] }) {
  const text = period ? periodText(period) : noPeriod;

  return (
    <div className="pfa-tasks-toolbar">
      <p className="pfa-period">
        <Icon name={calendar} />
        <span className="pfa-period-label">{periodLabel} </span>
        {text}
      </p>
      <PreviewAction label={historyLabel} icon={history} showLabel />
    </div>
  );
}
