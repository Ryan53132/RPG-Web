// Condições dos tokens: { e: emoji, d: rodadas restantes ou null (sem fim) }.
import { MAX_CONDITIONS } from "../config.js";

const PICTO = "\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?";
const EMOJI = new RegExp(`^${PICTO}(?:\\u200D${PICTO})*$`, "u"); // aceita sequências com ZWJ

export const cleanDuration = (d) => (Number.isInteger(d) && d >= 1 ? Math.min(99, d) : null);

/** Aceita emojis soltos ou objetos {e, d}; mantém só os válidos, sem repetir, até o limite. */
export function cleanConditions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const e = typeof item === "string" ? item : item?.e;
    const d = typeof item === "object" && item ? cleanDuration(item.d) : null;
    if (typeof e !== "string" || e.length > 16 || !EMOJI.test(e) || out.some((c) => c.e === e)) continue;
    out.push({ e, d });
    if (out.length >= MAX_CONDITIONS) break;
  }
  return out;
}
