import { describe, it, expect } from "vitest";
import { arr, strList, joinList, obj, objEntries, txt, num } from "../safe-json";

describe("safe-json", () => {
  it("arr", () => {
    expect(arr([1, 2])).toEqual([1, 2]);
    expect(arr("x")).toEqual([]);
    expect(arr(null)).toEqual([]);
  });
  it("strList / joinList handle strings, arrays, junk", () => {
    expect(strList(["a", 2, null, { x: 1 }])).toEqual(["a", "2"]);
    expect(strList("one line")).toEqual(["one line"]);
    expect(joinList("already a string")).toBe("already a string");
    expect(joinList(["a", "b"], ", ")).toBe("a, b");
    expect(joinList(undefined)).toBe("");
  });
  it("obj / objEntries", () => {
    expect(obj(null)).toEqual({});
    expect(obj([1])).toEqual({});
    expect(objEntries({ a: { winner: "A" }, b: null, c: "x" })).toEqual([["a", { winner: "A" }]]);
  });
  it("txt / num", () => {
    expect(txt(5)).toBe("5");
    expect(txt({})).toBe("");
    expect(num("1,200")).toBe(1200);
    expect(num("$12.5")).toBe(12.5);
    expect(num("abc", 7)).toBe(7);
  });
});
