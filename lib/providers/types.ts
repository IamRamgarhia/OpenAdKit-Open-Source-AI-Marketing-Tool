export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "groq"
  | "cerebras"
  | "openrouter"
  | "together"
  | "deepseek"
  | "mistral";

export type ProviderCategory = "free" | "freemium" | "paid";

/**
 * Image part for multimodal messages.
 * media_type is the MIME type (image/png, image/jpeg, image/webp, image/gif).
 * data is base64-encoded raw bytes (no `data:` prefix).
 */
export interface ImagePart {
  type: "image";
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string;
}

export interface TextPart {
  type: "text";
  text: string;
}

export type ContentPart = TextPart | ImagePart;

export interface LLMMessage {
  role: "user" | "assistant";
  /**
   * Either a plain text string (most calls) OR an array of parts for multimodal
   * input. Provider adapters translate this into their native format. Providers
   * with supports_vision=false will reject messages containing ImageParts.
   */
  content: string | ContentPart[];
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface LLMCallOptions {
  apiKey: string;
  model: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMResult {
  text: string;
  usage: LLMUsage | null;
  modelId: string;
}

export interface StreamHandlers {
  onDelta?: (delta: string) => void;
  onUsage?: (usage: LLMUsage) => void;
  onDone?: (full: string) => void;
}

export interface ModelDef {
  id: string;
  label: string;
  pricing: {
    input_per_million_usd: number;
    output_per_million_usd: number;
  };
  context_k?: number;
  best_for?: string;
  /** True if this specific model can accept image inputs. Defaults to the provider-level flag when omitted. */
  supports_vision?: boolean;
}

export interface Provider {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  description: string;
  free_note?: string;
  get_key_url: string;
  default_model: string;
  models: ModelDef[];
  /** True if at least one model in the provider's catalog can accept images. */
  supports_vision?: boolean;
  testKey: (apiKey: string) => Promise<boolean>;
  call: (opts: LLMCallOptions) => Promise<LLMResult>;
  stream: (opts: LLMCallOptions, handlers: StreamHandlers) => Promise<LLMResult>;
}

export class LLMError extends Error {
  constructor(message: string, public status?: number, public providerId?: string) {
    super(message);
    this.name = "LLMError";
  }
}
