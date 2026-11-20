/**
 * OpenAdKit MCP server (stdio).
 *
 * Exposes OpenAdKit's ad generators, optimizers and research tools to Claude
 * Desktop, Claude Code, Cursor and any MCP client, plus read access to the
 * client brands saved in the OpenAdKit app.
 *
 *   npx openadkit-mcp                      (after `npm run build:mcp`, or from the release)
 *
 * Environment:
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY / ...
 *       Optional. With a key, tools run the generation themselves and return
 *       validated JSON. Without one, tools return the prompt + JSON Schema so
 *       the host model writes the result (then calls validate_output).
 *   OPENADKIT_PROVIDER   pick a provider when several keys are set
 *   OPENADKIT_MODEL      override the provider's default model
 *   OPENADKIT_DATA_DIR   where the app's snapshot.json lives (auto-detected)
 *
 * Logs go to stderr only: stdout is the MCP protocol channel.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { AI_TOOLS, AI_TOOL_BY_NAME, type AiTool } from "../lib/tools/registry";
import {
  buildMessages,
  findBrand,
  generate,
  listBrands,
  outputJsonSchema,
  readSnapshot,
  resolveProvider,
  validateOutput,
} from "./runtime";

declare const __OPENADKIT_VERSION__: string;
const VERSION = typeof __OPENADKIT_VERSION__ === "string" ? __OPENADKIT_VERSION__ : "dev";

type TextResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const text = (value: unknown, isError = false): TextResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

const COMMON_INPUT = {
  client: z
    .string()
    .optional()
    .describe(
      "Optional saved client brand (id or business name from list_brands). Its tone, offers, audience and proof are used in the copy.",
    ),
  output_language: z.string().optional().describe("Language for the generated copy, e.g. 'Spanish', 'Hindi'. Defaults to English."),
  tone_override: z.string().optional().describe("Override the brand's tone for this run."),
  mode: z
    .enum(["auto", "generate", "prompt"])
    .optional()
    .describe(
      "'auto' (default): generate with the configured AI key if there is one, otherwise return the prompt for you to write. 'prompt': always return the prompt + JSON Schema. 'generate': require a configured key.",
    ),
};

export function createServer(env: NodeJS.ProcessEnv = process.env): McpServer {
  const server = new McpServer(
    { name: "openadkit", version: VERSION },
    {
      instructions:
        "OpenAdKit writes ad copy and campaign plans for Google, Meta, TikTok, LinkedIn, YouTube, X and email, " +
        "and diagnoses ad performance from real numbers. Call list_brands first if the user mentions a client, and pass its id as `client`. " +
        "When a tool returns mode='prompt', write the JSON it asks for (follow the system and user prompt exactly, " +
        "respect every character limit) and then call validate_output with the same tool name before showing it.",
    },
  );

  server.registerTool(
    "list_brands",
    {
      title: "List saved client brands",
      description: "Client brands (Brand Brains) saved in the OpenAdKit app on this computer.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { path: file, snapshot } = readSnapshot(env);
      const brands = listBrands(env).map((b) => ({
        id: b.id,
        business_name: b.business_name,
        industry: b.industry,
        website: b.website_url,
      }));
      if (!snapshot) {
        return text({
          brands: [],
          note: `No OpenAdKit data found at ${file}. Open the OpenAdKit app once (with the launcher running) so it saves your clients, or pass details directly to each tool.`,
        });
      }
      return text({ brands });
    },
  );

  server.registerTool(
    "get_brand",
    {
      title: "Get a client brand",
      description: "Full Brand Brain for one saved client: audience, offers, tone, proof, objections.",
      inputSchema: { brand: z.string().describe("Brand id or business name from list_brands.") },
      annotations: { readOnlyHint: true },
    },
    async ({ brand }) => {
      const found = findBrand(brand, env);
      return found ? text(found) : text(`No saved brand matches "${brand}". Call list_brands to see what exists.`, true);
    },
  );

  server.registerTool(
    "validate_output",
    {
      title: "Validate a tool result",
      description:
        "Check JSON you wrote for an OpenAdKit tool (prompt mode) against that tool's output schema. Returns the cleaned result or the exact problems to fix.",
      inputSchema: {
        tool: z.string().describe("The OpenAdKit tool name, e.g. generate_meta_ads."),
        output: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]).describe("The JSON (object or string)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ tool, output }) => {
      const def = AI_TOOL_BY_NAME[tool];
      if (!def) return text(`Unknown tool "${tool}".`, true);
      const res = validateOutput(def, output);
      return res.ok
        ? text({ valid: true, result: res.data })
        : text({ valid: false, fix_these: res.issues }, true);
    },
  );

  server.registerTool(
    "openadkit_status",
    {
      title: "OpenAdKit status",
      description: "Which AI provider and model the tools will use, and where saved client data is read from.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      let provider: string | null = null;
      let model: string | null = null;
      let error: string | null = null;
      try {
        const r = resolveProvider(env);
        provider = r?.provider.id ?? null;
        model = r?.model ?? null;
      } catch (e) {
        error = (e as Error).message;
      }
      const { path: file, snapshot } = readSnapshot(env);
      return text({
        version: VERSION,
        mode: provider ? "generate" : "prompt",
        provider,
        model,
        provider_error: error,
        data_file: file,
        saved_brands: snapshot ? listBrands(env).length : 0,
        tools: AI_TOOLS.length,
      });
    },
  );

  for (const tool of AI_TOOLS) registerAiTool(server, tool, env);
  return server;
}

function registerAiTool(server: McpServer, tool: AiTool, env: NodeJS.ProcessEnv) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: `${tool.description} (OpenAdKit ${tool.category}; same as ${tool.route} in the app.)`,
      inputSchema: { ...tool.input, ...COMMON_INPUT },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args: Record<string, unknown>, extra) => {
      // Shared options use names no tool field uses (several tools have their
      // own `brand` / `language` inputs), so nothing is shadowed or dropped.
      const { client: brandRef, output_language: language, tone_override, mode = "auto", ...input } = args as {
        client?: string;
        output_language?: string;
        tone_override?: string;
        mode?: "auto" | "generate" | "prompt";
      } & Record<string, unknown>;

      let brand = null;
      if (brandRef) {
        brand = findBrand(brandRef, env);
        if (!brand) return text(`No saved brand matches "${brandRef}". Call list_brands, or omit client.`, true);
      }
      const opts = { brand, language, toneOverride: tone_override };

      let resolved = null;
      try {
        resolved = mode === "prompt" ? null : resolveProvider(env);
      } catch (e) {
        return text((e as Error).message, true);
      }
      if (mode === "generate" && !resolved) {
        return text(
          "mode='generate' needs an AI key in the MCP server's environment (e.g. ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY).",
          true,
        );
      }

      let computed: unknown = undefined;
      try {
        computed = tool.computed ? tool.computed(input) : undefined;
      } catch {
        computed = undefined;
      }

      if (!resolved) {
        const { system, prompt } = buildMessages(tool, input, opts);
        return text({
          mode: "prompt",
          tool: tool.name,
          instructions:
            "No AI key is configured for OpenAdKit, so write this yourself: follow SYSTEM as your role and USER as the task, " +
            "return ONLY JSON matching output_schema, then call validate_output with tool=" +
            tool.name +
            " and show the user the validated result.",
          system,
          user: prompt,
          output_schema: outputJsonSchema(tool),
          ...(computed !== undefined ? { computed_in_code: computed } : {}),
        });
      }

      try {
        const result = await generate(tool, input, resolved, opts, extra.signal);
        return text({
          mode: "generate",
          tool: tool.name,
          ...result,
          ...(computed !== undefined ? { computed_in_code: computed } : {}),
        });
      } catch (e) {
        return text(`${tool.title} failed: ${(e as Error).message}`, true);
      }
    },
  );
}

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  const r = (() => {
    try {
      return resolveProvider();
    } catch {
      return null;
    }
  })();
  console.error(
    `[openadkit-mcp] v${VERSION} ready: ${AI_TOOLS.length} AI tools, ` +
      (r ? `generating with ${r.provider.id}/${r.model}` : "prompt mode (no AI key set)"),
  );
}

// Run when executed directly (not when imported by tests).
const isMain = (() => {
  try {
    const argv1 = process.argv[1] ? process.argv[1].replace(/\\/g, "/") : "";
    return /openadkit-mcp(\.m?js)?$|mcp\/server\.ts$/.test(argv1);
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((e) => {
    console.error("[openadkit-mcp] fatal:", e);
    process.exit(1);
  });
}
