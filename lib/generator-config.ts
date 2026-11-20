import type { ZodTypeAny } from "zod";
import type { Platform } from "./storage";
import type { BrandBrain } from "./brand-brain";

export type FieldKind = "text" | "textarea" | "select" | "number" | "image";

export interface InputField {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  span?: 1 | 2; // grid columns
  /** When set, the GeneratorShell renders a section heading above this field. Use the
   *  same string on consecutive fields to keep them under one heading. */
  section?: string;
}

export interface GeneratorConfig<I extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
  platform: Platform;
  /** Derive the stored platform from the form (e.g. hashtags / reel ideas
   *  have their own platform select). Falls back to `platform`. */
  platformFor?: (input: I) => Platform;
  campaign_type: string;
  fields: InputField[];
  initial: I;
  buildPrompt: (input: I, brain: BrandBrain | null) => string;
  /**
   * Optional async pre-step run after validation, before the prompt is built
   * (e.g. fetching a competitor URL). Return extra keys under `__`-prefixed
   * names — they reach buildPrompt but are never persisted with the ad.
   * A `warning` is shown in the info banner without failing the run.
   */
  prepareInput?: (input: I, signal: AbortSignal) => Promise<{ input: I; warning?: string }>;
  buildTitle: (input: I) => string;
  maxTokens?: number;
  temperature?: number;
  expectJson?: boolean;
  /**
   * Optional Zod schema. When set + expectJson true, the shell validates the
   * parsed JSON against this schema. On schema failure, a single non-streaming
   * retry round-trip is sent to the same model with the validation errors so
   * the model can self-correct. If the second attempt also fails, the user
   * sees a clear "model returned wrong shape" error instead of a UI crash.
   * This is the core of the "no false results" guarantee.
   */
  schema?: ZodTypeAny;
  renderJson?: (json: any) => React.ReactNode;
  /** Optional renderer that runs against the streaming text BEFORE final JSON parse. */
  renderStreaming?: (text: string) => React.ReactNode;
  /** Skip the (~1.1k-token) framework stack on short-form generators where the
   *  framework doesn't apply (hashtags, email subjects, concept explainers,
   *  framework lessons). Defaults to false — most generators benefit. */
  skip_framework_stack?: boolean;
}
