import DOMPurify from "dompurify";
import { marked } from "marked";
import TurndownService from "turndown";

const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export function renderMarkdown(body: string): string {
  const html = marked.parse(body, { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(DOMPurify.sanitize(html));
}
