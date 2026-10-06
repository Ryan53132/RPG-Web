// Expressões de dano com várias parcelas: "2d6+1d4+3", "1d8-1".
import { rollDie } from "../lib/util.js";

const TERM = /^([+-]?)(\d{1,2}d\d{1,3}|\d{1,4})$/;

export function parseExpr(expr) {
  const s = String(expr ?? "").replace(/\s/g, "").toLowerCase();
  if (!s || s.length > 40) return null;
  const parts = s.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join("") !== s || parts.length > 6) return null;
  const terms = [];
  for (const p of parts) {
    const m = TERM.exec(p);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    if (m[2].includes("d")) {
      const [n, sides] = m[2].split("d").map(Number);
      if (n < 1 || n > 30 || sides < 2 || sides > 100) return null;
      terms.push({ sign, n, sides });
    } else {
      terms.push({ sign, flat: Number(m[2]) });
    }
  }
  return terms;
}

export const validExpr = (expr) => !!parseExpr(expr);

/**
 * Rola a expressão. Em acerto crítico: D&D dobra os dados (não o bônus); Pathfinder 2e dobra o total.
 * Devolve { total, detail } ou null se a expressão for inválida.
 */
export function rollExpr(expr, { system, crit = false } = {}) {
  const terms = parseExpr(expr);
  if (!terms) return null;
  let total = 0;
  const detail = [];
  for (const t of terms) {
    if (t.flat !== undefined) {
      total += t.sign * t.flat;
      detail.push(`${t.sign < 0 ? "-" : "+"}${t.flat}`);
      continue;
    }
    const n = crit && system !== "pf2e" ? t.n * 2 : t.n;
    const rolls = Array.from({ length: n }, () => rollDie(t.sides));
    total += t.sign * rolls.reduce((a, b) => a + b, 0);
    detail.push(`${t.sign < 0 ? "-" : "+"}${n}d${t.sides}[${rolls.join(",")}]`);
  }
  if (crit && system === "pf2e") total *= 2;
  return { total: Math.max(0, total), detail: detail.join(" ").replace(/^\+/, "") };
}
