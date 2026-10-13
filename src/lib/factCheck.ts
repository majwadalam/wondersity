// Checks the arithmetic a lesson states, in code. The model reviewing its own
// lesson misses wrong sums: sample lessons said "3.50 + 2.00 + 1.25 + 4.75 =
// 19.00" and "11.5 sous of a 25-sous wage is over half", and their own
// reviewer passed them. Facts the harness can compute should be checked by the
// harness, not by a model (see HARNESS.md, "Checking facts in code").
//
// Only explicit claims are checked, so a finding is a real error:
//   "3.50 + 2.00 + 1.25 + 4.75 = 19.00"   an equation
//   "0.5 × 0.4 × 0.5 = 0.2 × 0.5 = 0.1"   a chain: every part must equal the first
//   "= 6.75, + 4.75 = 19.00"              a running total continuing one
//   "11.5 out of 25 is 46%", "11.5/25 = 46%"   a share stated as a percentage
// Trap feedback is skipped: it quotes wrong answers on purpose.

import { compileExpression } from "./expression";
import type { Lesson } from "./lessonBlocks";

// Commas only as thousands separators: "1,200" is a number, "1,40" (base-60
// notation in a Babylonian lesson) is not.
const NUM = String.raw`[-−]?[$£€]?(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?(?:e[-+]?\d+)?%?`;
// A number ends at anything but a letter, digit or decimal point (a full stop is fine).
const END = String.raw`(?![\w]|\.\d)`;
const OP = String.raw`(?:[+\-−*/÷×^]|\s[x]\s)`;
const EXPR = String.raw`${NUM}(?:\s*${OP}\s*${NUM})*`;
// Expressions joined by "=": "12/90 = 2/15", "2 × 3600 + 5 × 60 = 7200 + 300".
// "==" (code) and a "=" followed by a variable name don't match.
// It may not start in the middle of a formula it can't see: "(3.00 × 10^8)^2 = ...",
// "v^2 / 10 = ...".
const CHAIN = new RegExp(String.raw`(?<![\w.])(?<![)^*/×÷+\-−]\s*)${EXPR}(?:\s*=(?!=)\s*${EXPR})+${END}`, "g");
const CONTINUATION = new RegExp(String.raw`^\s*[,;]?\s*(${OP})\s*(${NUM})\s*=(?!=)\s*(${EXPR})${END}`);
// More of a number right after a match: a comma or point and a digit, a
// spaced group of three digits, or a letter glued to digits that were dropped.
const CUT_SHORT = /^(?:[,.]\d|[\s\u00a0\u2009\u202f]\d{3}(?!\d)|\d)/;
// "400 ÷ 60 = 6 remainder 40" is integer division, not a wrong quotient.
const REMAINDER = /^\s*(?:r\b|rem\b|remainder\b|with (?:a )?remainder\b|and \d+ left)/i;
const SHARE = new RegExp(String.raw`(?<![\w.])(${NUM})(?:\s+[a-z]+)?\s*(?:out of|of|/)\s*(?:an?\s+|the\s+)?(${NUM})\b[^.;:]{0,40}?\b(?:is|=|are|makes|comes to)\s*(?:about\s+|roughly\s+|around\s+|nearly\s+)?(\d+(?:\.\d+)?)\s*%`, "gi");

const SKIP_KEYS = new Set(["traps", "misconception", "wrong", "id", "ref", "correctAnswer", "options"]);

function clean(n: string) {
  return n.replace(/[$£€,]/g, "").replace(/−/g, "-");
}

function value(expr: string): number | null {
  const src = clean(expr)
    .replace(/\s[x]\s/g, " * ")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d)%/g, "$1/100");
  try {
    const v = compileExpression(src)(0, 0);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** True when `computed` rounds to the stated number at the precision it was written with. */
function matches(computed: number, stated: string) {
  const s = clean(stated).trim();
  // Another expression ("0.2 × 0.5", "2/15"): equal within 1%, for rounded steps.
  if (new RegExp(`^${EXPR}$`).test(s) && !new RegExp(`^${NUM}$`).test(s)) {
    const target = value(s);
    return target === null || Math.abs(computed - target) <= Math.abs(target) * 0.01 + 1e-9;
  }
  const percent = s.endsWith("%");
  const target = Number(s.replace("%", ""));
  if (!Number.isFinite(target)) return true;
  const decimals = /e/i.test(s) ? 0 : (s.split(".")[1]?.replace("%", "").length ?? 0);
  const c = percent ? computed * 100 : computed;
  // Half a unit in the last written place, or 1% for numbers rounded in prose.
  const tolerance = Math.max(0.5 * 10 ** -decimals, Math.abs(target) * 0.01);
  return Math.abs(c - target) <= tolerance + 1e-9;
}

function format(v: number) {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
}

// "8.9 x 10^-3" and "3.00 × 10^8" are one number, not a product.
const SCIENTIFIC = /(\d(?:\.\d+)?)\s*[x×]\s*10\s*\^\s*([-−]?\d+)/g;

function checkText(raw: string, where: string, out: string[]) {
  const text = raw.replace(SCIENTIFIC, (_, m: string, e: string) => `${m}e${e.replace("−", "-")}`);
  for (const m of text.matchAll(CHAIN)) {
    const whole = m[0];
    const after = text.slice((m.index ?? 0) + whole.length);
    if (REMAINDER.test(after)) continue;
    // The last number was cut short ("3,600s", "3 600", base-60 "1,0,0"): the
    // match stopped inside a longer number, so the claim can't be read; skip it.
    if (CUT_SHORT.test(after)) continue;
    const parts = whole.split(/=(?!=)/).map((p) => p.trim());
    // Only a claim with arithmetic in it; a percentage on one side only
    // ("20% + 5 = ...") is ambiguous.
    if (!parts.some((p) => new RegExp(OP).test(p.replace(/^[-−]/, "")))) continue;
    if (parts.some((p) => p.includes("%")) && !parts.every((p) => p.includes("%") || !new RegExp(OP).test(p))) continue;
    const reference = value(parts[0]);
    if (reference === null) continue;
    const wrong = parts.slice(1).find((p) => !matches(reference, p));
    if (wrong !== undefined) {
      out.push(`${where}: "${whole}" is wrong; ${parts[0]} = ${format(reference)}.`);
      continue;
    }
    // Follow a running total: "= 6.75, + 4.75 = 11.50".
    let total = value(parts[parts.length - 1].replace("%", "")) ?? NaN;
    let rest = after;
    for (let c = rest.match(CONTINUATION); c; c = rest.match(CONTINUATION)) {
      const [cont, op, operand, result] = c;
      const next = value(`${total} ${op.trim()} ${operand}`);
      if (next === null) break;
      if (!matches(next, result)) {
        out.push(`${where}: running total "${format(total)} ${op.trim()} ${operand.trim()} = ${result}" is wrong; it is ${format(next)}.`);
        break;
      }
      total = value(result.replace("%", "")) ?? NaN;
      rest = rest.slice(cont.length);
    }
  }
  for (const m of text.matchAll(SHARE)) {
    const [whole, part, of, pct] = m;
    const a = Number(clean(part).replace("%", ""));
    const b = Number(clean(of).replace("%", ""));
    if (!(b > 0) || /%/.test(part) || /%/.test(of)) continue;
    const computed = (a / b) * 100;
    // Prose rounds shares ("about a third", "roughly 46%"): allow 1.5 points.
    if (Math.abs(computed - Number(pct)) > 1.5) {
      out.push(`${where}: "${whole.trim()}" is wrong; ${format(a)} of ${format(b)} is ${format(computed)}%.`);
    }
  }
}

/**
 * Simple TeX math written as plain arithmetic, so it's checked like the rest:
 * \times and \cdot as ×, \div as ÷, \frac{6}{3} as 6/3 when both parts are
 * numbers, ^{3} as ^3, and the delimiters and spacing removed. Anything else
 * in TeX stays as it is, and the checker leaves it alone.
 */
export function plainMath(text: string) {
  if (!text.includes("\\") && !text.includes("$$")) return text;
  return text.replace(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g, (_, a?: string, b?: string, c?: string) =>
    (a ?? b ?? c ?? "")
      .replace(/\\(times|cdot)/g, " × ")
      .replace(/\\div/g, " ÷ ")
      .replace(/\\approx/g, " ≈ ")
      .replace(/\\[dt]?frac\{\s*(-?\d+(?:\.\d+)?)\s*\}\{\s*(-?\d+(?:\.\d+)?)\s*\}/g, "$1/$2")
      .replace(/\^\{\s*(-?\d+(?:\.\d+)?)\s*\}/g, "^$1")
      .replace(/\\(left|right)|\\[,;!]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function walk(node: unknown, path: string, out: string[]) {
  if (typeof node === "string") return checkText(plainMath(node), path, out);
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) continue;
      walk(v, path ? `${path}.${k}` : k, out);
    }
  }
}

/**
 * Arithmetic the lesson states that doesn't compute, one line each, naming
 * where it is and the right value. Empty when nothing checkable is wrong.
 */
export function checkFacts(lesson: Lesson): string[] {
  const out: string[] = [];
  walk(lesson, "", out);
  return [...new Set(out)];
}
