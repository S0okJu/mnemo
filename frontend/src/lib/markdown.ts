import DOMPurify from "dompurify";
import { marked } from "marked";
import TurndownService from "turndown";

const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export function renderMarkdown(body: string): string {
  const html = marked.parse(body, { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

export function htmlToMarkdown(html: string): string {
  // Strip zero-width spaces left behind as caret anchors by the formatted
  // editor's inline markdown-shortcut handling (see FormattedEditor.tsx).
  return turndownService.turndown(DOMPurify.sanitize(html)).replace(/​/g, "");
}
