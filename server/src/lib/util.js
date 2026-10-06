export const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
export const cleanStr = (s, max = 40) => String(s ?? "").slice(0, max);
export const cleanColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#c0392b");
export const cleanRoomId = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 30) || "mesa";
export const validPid = (s) => typeof s === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(s);
export const finite = (n) => Number.isFinite(Number(n));
export const clampVision = (n) => Math.min(20, Math.max(0, Math.trunc(Number(n)) || 0));
export const validBg = (s) => s === "" || s.startsWith("/uploads/") || /^https?:\/\//i.test(s);

export const isPlain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** Mescla objetos recursivamente ignorando chaves perigosas (anti prototype pollution). */
export function mergeDeep(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (FORBIDDEN.has(k)) continue;
    out[k] = isPlain(b[k]) && isPlain(a?.[k]) ? mergeDeep(a[k], b[k]) : b[k];
  }
  return out;
}

export const rollDie = (sides) => 1 + Math.floor(Math.random() * sides);

export function rollDice(expr) {
  const m = /^(\d{1,2})d(\d{1,3})([+-]\d{1,3})?$/i.exec(expr.replace(/\s/g, ""));
  if (!m) return null;
  const qty = Number(m[1]);
  const sides = Number(m[2]);
  const mod = Number(m[3] || 0);
  if (qty < 1 || sides < 2) return null;
  const rolls = Array.from({ length: qty }, () => rollDie(sides));
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod };
}
