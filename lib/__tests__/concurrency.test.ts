import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "../concurrency";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("mapWithConcurrency", () => {
  it("never exceeds the limit and preserves order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([5, 1, 4, 2, 3, 1], 2, async (n, i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick(n * 3);
      inFlight--;
      return i * 10;
    });
    expect(peak).toBe(2);
    expect(out.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("captures failures without dropping the rest", async () => {
    const out = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(out[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(out[1].status).toBe("rejected");
    expect(out[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  it("handles empty input", async () => {
    expect(await mapWithConcurrency([], 2, async () => 1)).toEqual([]);
  });
});
