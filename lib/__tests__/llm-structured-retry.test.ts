/**
 * Retry-path shape and null tolerance in lib/llm-structured.ts.
 *
 * `llmCall` is stubbed with literal reply strings (no network); what's under
 * test is the message list we build for the corrective round-trip and how we
 * validate replies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/llm", () => ({ llmCall: vi.fn() }));
vi.mock("@/lib/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/providers")>("@/lib/providers");
  return { ...actual, estimateCostUsd: () => 0 };
});

import { llmCall } from "@/lib/llm";
import { llmCallStructured, validateLlmJson, validateOrRetry } from "@/lib/llm-structured";

const mockLlm = vi.mocked(llmCall);
const reply = (text: string) => ({ text, usage: null, providerId: "anthropic", modelId: "claude-sonnet-5-5" }) as any;

const Schema = z.object({ title: z.string(), alt: z.string().optional(), items: z.array(z.object({ a: z.string(), b: z.string().optional() })) });

beforeEach(() => mockLlm.mockReset());

describe("null-valued keys are treated as absent", () => {
  it("validateLlmJson accepts nulls for optional fields, at any depth", () => {
    const r = validateLlmJson('{"title":"t","alt":null,"items":[{"a":"x","b":null}]}', Schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ title: "t", items: [{ a: "x" }] });
  });

  it("still rejects a null where a value is required", () => {
    const r = validateLlmJson('{"title":null,"items":[]}', Schema);
    expect(r.ok).toBe(false);
  });

  it("llmCallStructured succeeds first time when the model returns null optionals", async () => {
    mockLlm.mockResolvedValueOnce(reply('{"title":"t","alt":null,"items":[]}'));
    const r = await llmCallStructured({ schema: Schema, prompt: "p" });
    expect(r.attempts).toBe(1);
    expect(mockLlm).toHaveBeenCalledTimes(1);
  });
});

describe("empty first reply", () => {
  it("llmCallStructured does not send an empty assistant turn on retry", async () => {
    mockLlm.mockResolvedValueOnce(reply("")).mockResolvedValueOnce(reply('{"title":"t","items":[]}'));
    const r = await llmCallStructured({ schema: Schema, prompt: "write it" });
    expect(r.recovered).toBe(true);
    const retryMessages = mockLlm.mock.calls[1][0].messages;
    for (const m of retryMessages) {
      if (m.role === "assistant") expect(String(m.content).trim()).not.toBe("");
    }
    // roles must still alternate, starting and ending with user
    expect(retryMessages[0].role).toBe("user");
    expect(retryMessages[retryMessages.length - 1].role).toBe("user");
    for (let i = 1; i < retryMessages.length; i++) {
      expect(retryMessages[i].role).not.toBe(retryMessages[i - 1].role);
    }
    expect(String(retryMessages[retryMessages.length - 1].content)).toMatch(/write it/);
  });

  it("validateOrRetry does not send an empty assistant turn", async () => {
    mockLlm.mockResolvedValueOnce(reply('{"title":"t","items":[]}'));
    await validateOrRetry({ schema: Schema, raw: "   ", originalPrompt: "write it" });
    const msgs = mockLlm.mock.calls[0][0].messages;
    expect(msgs.some((m: any) => m.role === "assistant")).toBe(false);
    expect(msgs).toHaveLength(1);
    expect(String(msgs[0].content)).toMatch(/write it/);
  });

  it("keeps a non-empty wrong reply as the assistant turn", async () => {
    mockLlm.mockResolvedValueOnce(reply('{"title":"t","items":[]}'));
    await validateOrRetry({ schema: Schema, raw: '{"nope":1}', originalPrompt: "write it" });
    const msgs = mockLlm.mock.calls[0][0].messages;
    expect(msgs.map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});
