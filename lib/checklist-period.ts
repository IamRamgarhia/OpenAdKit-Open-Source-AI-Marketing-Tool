/**
 * Period + streak logic for the daily / weekly / monthly routines.
 * Extracted from ChecklistView so it can be unit-tested.
 */
export type ChecklistScope = "daily" | "weekly" | "monthly";

export function periodKey(scope: ChecklistScope, when: Date = new Date()): string {
  const y = when.getFullYear();
  if (scope === "daily") {
    return `${y}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  }
  if (scope === "weekly") {
    // ISO-8601 week numbering — the old `onejan + getDay()` formula miscounted
    // around year boundaries and silently reset streaks every New Year.
    const [isoYear, isoWeek] = isoWeekOf(when);
    return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  }
  return `${y}-${String(when.getMonth() + 1).padStart(2, "0")}`;
}

/** ISO-8601 week-year + week number. */
export function isoWeekOf(date: Date): [number, number] {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return [isoYear, week];
}

/** The same calendar position one period earlier. */
export function previousPeriodDate(scope: ChecklistScope, now: Date): Date {
  const d = new Date(now.getTime());
  if (scope === "daily") d.setDate(d.getDate() - 1);
  else if (scope === "weekly") d.setDate(d.getDate() - 7);
  else {
    // Pin to the 1st before stepping back so Mar 31 → Feb (not Mar 3).
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
  }
  return d;
}

export function isInCurrentPeriod(scope: ChecklistScope, lastCompleted: number | null | undefined, now: Date = new Date()): boolean {
  if (lastCompleted == null) return false;
  return periodKey(scope, new Date(lastCompleted)) === periodKey(scope, now);
}

export function isInPreviousPeriod(scope: ChecklistScope, lastCompleted: number | null | undefined, now: Date = new Date()): boolean {
  if (lastCompleted == null) return false;
  return periodKey(scope, new Date(lastCompleted)) === periodKey(scope, previousPeriodDate(scope, now));
}

/**
 * Streak after the user CHECKS an item.
 *
 *  - Already completed earlier in this same period (checked → unchecked →
 *    re-checked): keep the streak as is. It used to reset to 1, because the
 *    "continued" test only looked at the previous period.
 *  - Completed in the previous period: streak + 1.
 *  - Anything older / never: start at 1.
 */
export function streakAfterCheck(
  scope: ChecklistScope,
  prev: { streak?: number; last_completed?: number | null } | undefined,
  now: Date = new Date()
): number {
  const streak = Math.max(0, Math.floor(Number(prev?.streak) || 0));
  if (isInCurrentPeriod(scope, prev?.last_completed, now)) return Math.max(1, streak);
  if (isInPreviousPeriod(scope, prev?.last_completed, now)) return streak + 1;
  return 1;
}
