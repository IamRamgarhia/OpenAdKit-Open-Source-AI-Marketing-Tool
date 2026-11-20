#!/usr/bin/env node
/**
 * Add (or remove) OpenAdKit's MCP server in Claude Desktop's config.
 *
 *   node scripts/register-mcp.cjs              add / update "openadkit"
 *   node scripts/register-mcp.cjs --remove     remove it
 *   node scripts/register-mcp.cjs --detect     exit 0 if Claude Desktop is installed
 *   node scripts/register-mcp.cjs --print      print the config block, change nothing
 *   Options: --config <file>  --node <node binary>  --script <openadkit-mcp.mjs>
 *
 * Safe merge: other MCP servers and settings are left untouched, the old
 * file is backed up next to it (.openadkit-backup), and a config that isn't
 * valid JSON is never overwritten. Used by the Windows installer's
 * "Connect to Claude Desktop" option and by install.sh.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER_NAME = "openadkit";

function claudeConfigPath(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === "win32") return path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "Claude", "claude_desktop_config.json");
}

function defaultScript() {
  return path.resolve(__dirname, "..", "mcp", "openadkit-mcp.mjs");
}

/** The mcpServers entry for OpenAdKit. */
function serverEntry(nodePath, scriptPath) {
  return { command: nodePath, args: [scriptPath] };
}

/**
 * Pure merge: returns the new config object. Throws on invalid JSON text.
 * `existingText` may be empty / undefined (no config yet).
 */
function mergeConfig(existingText, entry, { remove = false } = {}) {
  let cfg = {};
  if (existingText && existingText.trim()) {
    cfg = JSON.parse(existingText);
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("config is not a JSON object");
  }
  const servers = cfg.mcpServers && typeof cfg.mcpServers === "object" ? { ...cfg.mcpServers } : {};
  if (remove) delete servers[SERVER_NAME];
  else servers[SERVER_NAME] = { ...(servers[SERVER_NAME] || {}), ...entry };
  return { ...cfg, mcpServers: servers };
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv = process.argv.slice(2)) {
  const configPath = arg(argv, "--config") || claudeConfigPath();
  const nodePath = arg(argv, "--node") || process.execPath;
  const scriptPath = arg(argv, "--script") || defaultScript();
  const entry = serverEntry(nodePath, scriptPath);

  if (argv.includes("--detect")) {
    process.exit(fs.existsSync(path.dirname(configPath)) ? 0 : 1);
  }
  if (argv.includes("--print")) {
    console.log(JSON.stringify({ mcpServers: { [SERVER_NAME]: entry } }, null, 2));
    return 0;
  }
  const remove = argv.includes("--remove");
  if (!remove && !fs.existsSync(scriptPath)) {
    console.error(`[register-mcp] MCP server not found at ${scriptPath}`);
    return 2;
  }
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  let next;
  try {
    next = mergeConfig(existing, entry, { remove });
  } catch (e) {
    console.error(`[register-mcp] ${configPath} is not valid JSON (${e.message}); left unchanged. Add OpenAdKit by hand:`);
    console.error(JSON.stringify({ mcpServers: { [SERVER_NAME]: entry } }, null, 2));
    return 2;
  }
  if (remove && !existing) return 0;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  if (existing) fs.writeFileSync(`${configPath}.openadkit-backup`, existing);
  const tmp = `${configPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
  fs.renameSync(tmp, configPath);
  console.log(
    remove
      ? `[register-mcp] Removed OpenAdKit from ${configPath}`
      : `[register-mcp] OpenAdKit added to Claude Desktop (${configPath}). Restart Claude Desktop to load it.`,
  );
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { SERVER_NAME, claudeConfigPath, serverEntry, mergeConfig, main };
