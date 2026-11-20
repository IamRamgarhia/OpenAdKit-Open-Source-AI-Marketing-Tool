import { describe, it, expect } from "vitest";
import { isNavItemActive, pathMatchesHref } from "../nav-active";

describe("pathMatchesHref", () => {
  it("matches exact path and sub-routes on a segment boundary", () => {
    expect(pathMatchesHref("/brand", "/brand")).toBe(true);
    expect(pathMatchesHref("/brand/new", "/brand")).toBe(true);
    expect(pathMatchesHref("/brandkit", "/brand")).toBe(false);
  });

  it("does not light /generate/google while on /generate/google-pmax", () => {
    expect(pathMatchesHref("/generate/google-pmax", "/generate/google")).toBe(false);
    expect(pathMatchesHref("/generate/google-pmax", "/generate/google-pmax")).toBe(true);
  });

  it("root only matches root", () => {
    expect(pathMatchesHref("/", "/")).toBe(true);
    expect(pathMatchesHref("/history", "/")).toBe(false);
  });

  it("handles null path", () => {
    expect(pathMatchesHref(null, "/brand")).toBe(false);
  });
});

describe("isNavItemActive", () => {
  const tiktok = { href: "/generate/hashtags", query: "platform=tiktok" };
  const insta = { href: "/generate/hashtags", query: "platform=instagram" };

  it("picks the duplicate whose query matches the URL", () => {
    expect(isNavItemActive("/generate/hashtags", "?platform=tiktok", tiktok)).toBe(true);
    expect(isNavItemActive("/generate/hashtags", "?platform=tiktok", insta)).toBe(false);
  });

  it("keeps duplicates active when the URL has no query to disambiguate", () => {
    expect(isNavItemActive("/generate/hashtags", "", tiktok)).toBe(true);
    expect(isNavItemActive("/generate/hashtags", null, insta)).toBe(true);
  });

  it("accepts URLSearchParams", () => {
    expect(isNavItemActive("/generate/hashtags", new URLSearchParams("platform=instagram"), insta)).toBe(true);
  });

  it("items without query ignore the search string", () => {
    expect(isNavItemActive("/history", "?focus=abc", { href: "/history" })).toBe(true);
  });

  it("wrong path is never active regardless of query", () => {
    expect(isNavItemActive("/generate/hashtagsx", "?platform=tiktok", tiktok)).toBe(false);
  });
});
