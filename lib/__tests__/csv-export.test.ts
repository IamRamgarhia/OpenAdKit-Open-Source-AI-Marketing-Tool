import { describe, it, expect } from "vitest";
import { csvCell, historyToCsv, HISTORY_CSV_HEADERS } from "../csv-export";

describe("csvCell", () => {
  it("quotes and doubles inner quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("neutralises formula triggers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("-2")).toBe('"\'-2"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tcmd")).toBe('"\'\tcmd"');
    expect(csvCell("\rcmd")).toBe('"\'\ncmd"');
  });

  it("leaves ordinary text alone", () => {
    expect(csvCell("Hello world")).toBe('"Hello world"');
    expect(csvCell(0.5)).toBe('"0.5"');
    expect(csvCell(null)).toBe('""');
  });

  it("keeps embedded newlines inside the quoted cell", () => {
    expect(csvCell("a\r\nb")).toBe('"a\nb"');
  });
});

describe("historyToCsv", () => {
  it("includes output_text and escapes every column", () => {
    const csv = historyToCsv([
      {
        id: "a1",
        brand_id: "b",
        platform: "meta",
        campaign_type: "Feed",
        title: "=cmd|' /C calc'!A0",
        input: {},
        output_json: null,
        output_text: "Headline: Save 20%\nBody: Try it",
        model_id: "m",
        usage_input_tokens: 10,
        usage_output_tokens: 20,
        cost_usd: 0.001,
        starred: false,
        status: "draft",
        notes: "",
        created_at: 0,
      },
    ]);
    const [head, ...rest] = csv.split("\r\n");
    expect(head.split(",")).toHaveLength(HISTORY_CSV_HEADERS.length);
    expect(head).toContain('"output_text"');
    const body = rest.join("\r\n");
    expect(body).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(body).toContain('"Headline: Save 20%\nBody: Try it"');
  });
});
