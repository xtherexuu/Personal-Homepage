import "server-only";

import { generateHTML } from "@tiptap/html";
import sanitizeHtml from "sanitize-html";

import { editorExtensions } from "@/lib/editor-extensions";
import { SITE } from "@/lib/site";

/**
 * Editor document → mailable e-mail, entirely server-side. The client sends
 * the Tiptap JSON document, never HTML: the server regenerates the markup
 * itself (same extension list as the editor), sanitizes it against an
 * allowlist, inlines styles (Gmail strips <style> blocks and classes), and
 * derives the text/plain alternative from the document tree. Client-supplied
 * markup is never trusted, stored, or sent.
 */

/* -------------------------------- sanitize -------------------------------- */

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "a", "h1", "h2", "h3", "ul", "ol", "li",
    "blockquote", "hr", "code", "pre",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  // No data:, no javascript:, no protocol-relative — a link is a link.
  allowedSchemes: ["https", "http", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

/* ------------------------------ inline styles ------------------------------ */

/**
 * Fixed per-tag styles injected AFTER sanitization (sanitize-html strips
 * `style`, so the order is load-bearing). String replacement is safe here
 * precisely because the input is our own sanitized output: tag names are
 * lowercase, and only <a> carries attributes.
 */
const TAG_STYLES: Record<string, string> = {
  p: "margin:0 0 12px;",
  h1: "font-size:24px;line-height:1.3;margin:24px 0 12px;",
  h2: "font-size:20px;line-height:1.3;margin:20px 0 10px;",
  h3: "font-size:17px;line-height:1.3;margin:18px 0 8px;",
  ul: "margin:0 0 12px;padding-left:24px;",
  ol: "margin:0 0 12px;padding-left:24px;",
  li: "margin:4px 0;",
  blockquote:
    "margin:0 0 12px;padding:2px 0 2px 14px;border-left:3px solid #d0d0d0;color:#555555;",
  hr: "border:none;border-top:1px solid #e0e0e0;margin:20px 0;",
  a: "color:#1a73e8;",
  pre: "background:#f5f5f5;padding:12px;border-radius:6px;font-family:ui-monospace,Consolas,monospace;font-size:13px;overflow:auto;margin:0 0 12px;",
  code: "font-family:ui-monospace,Consolas,monospace;font-size:13px;",
};

function inlineStyles(html: string): string {
  let out = html;
  for (const [tag, style] of Object.entries(TAG_STYLES)) {
    out = out
      .replaceAll(`<${tag}>`, `<${tag} style="${style}">`)
      .replaceAll(`<${tag} `, `<${tag} style="${style}" `);
  }
  return out;
}

/* ------------------------------ text fallback ------------------------------ */

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
  "codeBlock",
]);

type Mark = { type?: unknown; attrs?: { href?: unknown } };
type DocNode = {
  type?: unknown;
  text?: unknown;
  content?: unknown;
  marks?: unknown;
};

function textOf(node: DocNode): string {
  if (node.type === "text") {
    const text = typeof node.text === "string" ? node.text : "";
    // A link is invisible in text/plain — the URL is the whole point of the
    // link, so spell it out as `text (href)` when it isn't already the text.
    if (Array.isArray(node.marks)) {
      const href = (node.marks as Mark[]).find((m) => m?.type === "link")?.attrs
        ?.href;
      if (typeof href === "string" && href && href !== text) {
        return `${text} (${href})`;
      }
    }
    return text;
  }
  if (node.type === "hardBreak") return "\n";
  const inner = Array.isArray(node.content)
    ? (node.content as DocNode[]).map(textOf).join("")
    : "";
  return typeof node.type === "string" && BLOCKS.has(node.type)
    ? `${inner}\n`
    : inner;
}

/* --------------------------------- wrapper --------------------------------- */

function wrap(bodyHtml: string): string {
  return (
    `<!doctype html><html lang="pl"><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="max-width:640px;margin:0 auto;padding:24px 20px;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1c;">` +
    bodyHtml +
    `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e6e6e6;` +
    `color:#8a8a8a;font-size:13px;">Bartosz Załęski · ` +
    `<a href="${SITE}" style="color:#8a8a8a;">${SITE.replace("https://", "")}</a>` +
    `</div></div></body></html>`
  );
}

/* ---------------------------------- entry ---------------------------------- */

export type RenderedEmail = {
  /** Sanitized, inlined inner markup — what the panel stores and displays. */
  bodyHtml: string;
  /** The full wrapped document that actually goes out over SMTP. */
  html: string;
  /** text/plain alternative derived from the document tree. */
  text: string;
};

/** Deny by default: anything that isn't a renderable, non-empty doc is null. */
export function renderEmailFromDoc(docRaw: string): RenderedEmail | null {
  let doc: unknown;
  try {
    doc = JSON.parse(docRaw);
  } catch {
    return null;
  }
  if (
    typeof doc !== "object" ||
    doc === null ||
    (doc as DocNode).type !== "doc"
  ) {
    return null;
  }

  let raw: string;
  try {
    // Unknown node/mark types throw here — the schema IS the allowlist.
    raw = generateHTML(doc as Parameters<typeof generateHTML>[0], editorExtensions());
  } catch {
    return null;
  }

  const text = textOf(doc as DocNode).replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return null;

  const bodyHtml = inlineStyles(sanitizeHtml(raw, SANITIZE_OPTS));
  return { bodyHtml, html: wrap(bodyHtml), text };
}
