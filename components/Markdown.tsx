"use client";

import { memo } from "react";

/**
 * Minimal markdown renderer — no external dep, fast, safe-ish for trusted Claude output.
 * Handles: # headers, **bold**, lists, code blocks. No HTML passthrough.
 */
function escape(s: string): string {
  // Quote escape included for defense-in-depth — currently renderInline only
  // emits <strong>/<em>/<code> with no attributes, but any future tag with
  // attributes (e.g. <a href>) would otherwise be vulnerable to attribute
  // injection via `**foo" onmouseover="alert(1)**`. (Audit finding #47.)
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code class="px-1 py-0.5 rounded bg-zinc-800 text-[11px]">${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let inList: "ul" | "ol" | null = null;

  function closeList() {
    if (inList) {
      out.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  }

  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push(
          `<pre class="rounded bg-zinc-950 border border-zinc-800 p-3 my-2 text-[11px] overflow-x-auto"><code>${escape(
            codeBuf.join("\n")
          )}</code></pre>`
        );
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const level = h[1].length;
      const sizes = ["text-xl", "text-lg", "text-base", "text-sm"];
      out.push(`<h${level} class="${sizes[level - 1]} font-semibold mt-4 mb-2">${renderInline(escape(h[2]))}</h${level}>`);
      continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (inList !== "ul") {
        closeList();
        out.push('<ul class="list-disc list-inside space-y-1 my-2 text-sm">');
        inList = "ul";
      }
      out.push(`<li>${renderInline(escape(ul[1]))}</li>`);
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      if (inList !== "ol") {
        closeList();
        out.push('<ol class="list-decimal list-inside space-y-1 my-2 text-sm">');
        inList = "ol";
      }
      out.push(`<li>${renderInline(escape(ol[2]))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeList();
      out.push("");
      continue;
    }
    closeList();
    out.push(`<p class="text-sm my-2 text-zinc-300">${renderInline(escape(line))}</p>`);
  }
  closeList();

  return (
    <div
      className="prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: out.join("\n") }}
    />
  );
});
