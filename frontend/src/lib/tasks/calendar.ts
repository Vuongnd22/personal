function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dayNumberToIso(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** 0=Mon .. 6=Sun, so weeks start on Monday. */
function mondayIndex(iso: string): number {
  const jsDay = new Date(dayNumber(iso) * 86_400_000).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  weeks: CalendarDay[][];
}

export function buildCalendarMonth(year: number, month: number, today: string): CalendarMonth {
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstDay = dayNumber(firstOfMonth);
  const leadingDays = mondayIndex(firstOfMonth);
  const gridStart = firstDay - leadingDays;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastOfMonth = dayNumber(
    `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
  );
  const trailingDays = 6 - mondayIndex(dayNumberToIso(lastOfMonth));
  const gridEnd = lastOfMonth + trailingDays;

  const totalDays = gridEnd - gridStart + 1;
  const days: CalendarDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dayNum = gridStart + i;
    const iso = dayNumberToIso(dayNum);
    days.push({
      date: iso,
      isCurrentMonth: dayNum >= firstDay && dayNum <= lastOfMonth,
      isToday: iso === today,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return { year, month, weeks };
}

export function bucketTasksByDeadline<T extends { deadline: string | null }>(
  tasks: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const task of tasks) {
    if (!task.deadline) continue;
    const key = task.deadline.slice(0, 10);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(task);
    } else {
      map.set(key, [task]);
    }
  }
  return map;
}
