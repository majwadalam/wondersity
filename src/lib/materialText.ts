// Text from a learner's uploaded file: PDF (unpdf, page by page, with page
// markers so passages can say where they're from), Word (mammoth), or plain
// text and Markdown. Nothing is stored here; the text goes back to the
// browser and comes with the course request (lib/intake.ts).

import { INTAKE_LIMITS } from "./intake";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type FileKind = "pdf" | "docx" | "text";

/** What kind of file this is, from its type and name; null if it isn't one we read. */
export function fileKind(name: string, type: string): FileKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") return "docx";
  if (type.startsWith("text/") || ["txt", "md", "markdown", "csv"].includes(ext)) return "text";
  return null;
}

/** Collapses the spacing PDF and Word extraction leaves behind. */
export function tidy(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(bytes: Uint8Array, kind: FileKind): Promise<{ text: string; pages?: number }> {
  if (kind === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(bytes);
    const { totalPages, text } = await pdfText(doc, { mergePages: false });
    const pages = text.map((t, i) => (tidy(t) ? `[p. ${i + 1}]\n${tidy(t)}` : "")).filter(Boolean);
    return { text: pages.join("\n\n"), pages: totalPages };
  }
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: tidy(value) };
  }
  return { text: tidy(new TextDecoder("utf-8", { fatal: false }).decode(bytes)) };
}

/** Keeps a file's text inside the per-material limit, saying whether it was cut. */
export function capText(text: string) {
  const max = INTAKE_LIMITS.materialChars;
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text, truncated: false };
}
