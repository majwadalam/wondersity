import type { ReactNode } from "react";
import { MATH, TeX, unwrapMath } from "./math";

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/;

/**
 * Inline lesson text: math (lesson/math.tsx), `inline code` as code and
 * **bold** as bold. Everything else stays plain text. Math is split out
 * first, so a * or ` inside TeX is left alone.
 */
export function rich(text: string): ReactNode {
  if (!/[`*\\$]/.test(text)) return text;
  return text.split(MATH).flatMap((piece, m) => {
    if (m % 2) {
      const { tex, display } = unwrapMath(piece);
      return [<TeX key={`m${m}`} tex={tex} display={display} />];
    }
    if (!piece.includes("`") && !piece.includes("**")) return [piece];
    return piece.split(INLINE).map((part, i) => {
      if (i % 2 === 0) return part;
      if (part.startsWith("`"))
        return (
          <code key={`${m}-${i}`} className="inline-code font-mono">
            {part.slice(1, -1)}
          </code>
        );
      return (
        <strong key={`${m}-${i}`} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    });
  });
}

type Chunk = { kind: "text"; lines: string[] } | { kind: "table"; rows: string[][] } | { kind: "list"; ordered: boolean; items: string[] };

const isTableLine = (l: string) => /^\|.*\|$/.test(l.trim());
const isSeparator = (l: string) => /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{0,}:?\s*\|?$/.test(l.trim());
const listItem = (l: string) => l.trim().match(/^(?:([-*•])|(\d+)[.)])\s+(.*)$/);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/**
 * Splits one paragraph into the markdown writers reach for: tables (lines
 * between pipes), lists ("- " or "1. ") and plain lines. Models write these
 * even when not asked, and shown raw they are a row of pipes (a game-theory
 * payoff table, 2026-10-12).
 */
export function chunks(paragraph: string): Chunk[] {
  const out: Chunk[] = [];
  for (const line of paragraph.split("\n")) {
    const last = out[out.length - 1];
    const item = listItem(line);
    if (isTableLine(line)) {
      if (isSeparator(line)) continue;
      if (last?.kind === "table") last.rows.push(cells(line));
      else out.push({ kind: "table", rows: [cells(line)] });
    } else if (item) {
      const ordered = !item[1];
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item[3]);
      else out.push({ kind: "list", ordered, items: [item[3]] });
    } else if (line.trim()) {
      if (last?.kind === "text") last.lines.push(line.trim());
      else out.push({ kind: "text", lines: [line.trim()] });
    }
  }
  // A single pipe line isn't a table; a single "1." line is just text.
  return out.map((c) =>
    c.kind === "table" && c.rows.length < 2 ? { kind: "text", lines: [c.rows[0].join(" | ")] } : c
  );
}

export function Chunk({ chunk, className = "" }: { chunk: Chunk; className?: string }) {
  if (chunk.kind === "text") return <p className={className}>{rich(chunk.lines.join(" "))}</p>;
  if (chunk.kind === "list") {
    const List = chunk.ordered ? "ol" : "ul";
    return (
      <List className={`${chunk.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6 marker:text-muted ${className}`}>
        {chunk.items.map((item, i) => (
          <li key={i}>{rich(item)}</li>
        ))}
      </List>
    );
  }
  const [head, ...body] = chunk.rows;
  const width = Math.max(...chunk.rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  return (
    <div className={`overflow-x-auto rounded-xl border border-line ${className}`}>
      <table className="w-full border-collapse text-left text-[15px] leading-snug">
        <thead className="bg-canvas">
          <tr>
            {pad(head).map((c, i) => (
              <th key={i} scope="col" className="border-b border-line px-3 py-2 font-semibold text-fg">
                {rich(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-t border-line first:border-t-0">
              {pad(r).map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="px-3 py-2 font-semibold text-fg">
                    {rich(c)}
                  </th>
                ) : (
                  <td key={j} className="px-3 py-2 tabular-nums">
                    {rich(c)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
