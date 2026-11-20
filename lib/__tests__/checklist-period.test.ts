import { describe, it, expect } from "vitest";
import { periodKey, streakAfterCheck, isInCurrentPeriod, previousPeriodDate } from "../checklist-period";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("periodKey", () => {
  it("daily / monthly keys", () => {
    expect(periodKey("daily", at(2026, 3, 5))).toBe("2026-03-05");
    expect(periodKey("monthly", at(2026, 3, 5))).toBe("2026-03");
  });
  it("ISO week across the year boundary", () => {
    // 2026-01-01 is a Thursday → ISO week 1 of 2026; 2025-12-29 (Mon) is in the same week.
    expect(periodKey("weekly", at(2025, 12, 29))).toBe(periodKey("weekly", at(2026, 1, 1)));
    expect(periodKey("weekly", at(2026, 1, 1))).toBe("2026-W01");
  });
});

describe("previousPeriodDate", () => {
  it("steps a month back without overflowing on the 31st", () => {
    expect(periodKey("monthly", previousPeriodDate("monthly", at(2026, 3, 31)))).toBe("2026-02");
  });
});

describe("streakAfterCheck", () => {
  const now = at(2026, 5, 10, 18);

  it("first ever check starts at 1", () => {
    expect(streakAfterCheck("daily", undefined, now)).toBe(1);
  });

  it("completed yesterday → +1", () => {
    expect(streakAfterCheck("daily", { streak: 4, last_completed: at(2026, 5, 9).getTime() }, now)).toBe(5);
  });

  it("gap of more than one period → reset to 1", () => {
    expect(streakAfterCheck("daily", { streak: 4, last_completed: at(2026, 5, 7).getTime() }, now)).toBe(1);
  });

  it("uncheck + recheck in the same period keeps the streak (regression)", () => {
    // Checked earlier today (streak became 5), then unchecked; re-checking must not reset or double-count.
    const prev = { streak: 5, last_completed: at(2026, 5, 10, 9).getTime() };
    expect(streakAfterCheck("daily", prev, now)).toBe(5);
  });

  it("weekly + monthly continuations", () => {
    expect(streakAfterCheck("weekly", { streak: 2, last_completed: at(2026, 5, 3).getTime() }, now)).toBe(3);
    expect(streakAfterCheck("monthly", { streak: 7, last_completed: at(2026, 4, 2).getTime() }, now)).toBe(8);
  });

  it("isInCurrentPeriod", () => {
    expect(isInCurrentPeriod("daily", at(2026, 5, 10, 1).getTime(), now)).toBe(true);
    expect(isInCurrentPeriod("daily", null, now)).toBe(false);
  });
});
