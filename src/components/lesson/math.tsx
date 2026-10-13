import katex from "katex";
import "katex/contrib/mhchem";

/**
 * TeX in lesson text, typeset by KaTeX: \( inline \), \[ display \] or
 * $$ display $$, and \ce{H2O} for chemistry. A single $ is never math, since
 * lessons use it for prices. Bad TeX shows as its source in red instead of
 * breaking the step; KaTeX escapes everything it outputs and runs no commands
 * that load or link anything (trust is off).
 */
export function TeX({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
  return display ? (
    <span className="math-display block overflow-x-auto overflow-y-hidden py-1" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** The math in a piece of text: \(…\), \[…\] and $$…$$. */
export const MATH = /(\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\$\$[\s\S]+?\$\$)/;

/** A matched piece of math, unwrapped: its TeX and whether it's displayed on its own line. */
export function unwrapMath(part: string) {
  if (part.startsWith("\\(")) return { tex: part.slice(2, -2), display: false };
  return { tex: part.slice(2, -2), display: true };
}
