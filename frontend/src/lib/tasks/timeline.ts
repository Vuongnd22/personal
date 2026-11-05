export type TimelineZoom = "day" | "week";

export interface TimelineTaskLike {
  id: string;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  isOverdue: boolean;
  completedLate: boolean;
}

export interface TimelineBar {
  taskId: string;
  startOffset: number;
  span: number;
  isOverdue: boolean;
  completedLate: boolean;
}

export interface TimelineLayout {
  bars: TimelineBar[];
  rangeStart: string;
  rangeEnd: string;
  totalDays: number;
  todayOffset: number | null;
}

/** Day count since the epoch for a "YYYY-MM-DD"-prefixed date string, timezone-independent. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dayNumberToIso(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function barStartDay(task: TimelineTaskLike): number {
  return dayNumber(task.startDate ?? task.createdAt);
}

function barEndDay(task: TimelineTaskLike): number {
  return dayNumber(task.deadline ?? task.startDate ?? task.createdAt);
}

export function computeTimelineLayout(tasks: TimelineTaskLike[], today: string): TimelineLayout {
  if (tasks.length === 0) {
    return {
      bars: [],
      rangeStart: today,
      rangeEnd: today,
      totalDays: 1,
      todayOffset: 0,
    };
  }

  const todayDay = dayNumber(today);
  const minStart = Math.min(...tasks.map(barStartDay));
  const maxEnd = Math.max(...tasks.map(barEndDay));

  const rangeStartDay = minStart;
  const rangeEndDay = maxEnd;
  const totalDays = rangeEndDay - rangeStartDay + 1;

  const bars: TimelineBar[] = tasks.map((task) => {
    const start = barStartDay(task);
    const end = barEndDay(task);
    return {
      taskId: task.id,
      startOffset: start - rangeStartDay,
      span: Math.max(1, end - start + 1),
      isOverdue: task.isOverdue,
      completedLate: task.completedLate,
    };
  });

  const todayOffsetRaw = todayDay - rangeStartDay;
  const todayOffset = todayOffsetRaw >= 0 && todayOffsetRaw < totalDays ? todayOffsetRaw : null;

  return {
    bars,
    rangeStart: dayNumberToIso(rangeStartDay),
    rangeEnd: dayNumberToIso(rangeEndDay),
    totalDays,
    todayOffset,
  };
}

export function dayWidthForZoom(zoom: TimelineZoom): number {
  return zoom === "day" ? 40 : 12;
}
