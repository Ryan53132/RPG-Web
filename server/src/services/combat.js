// Regras de combate: ataque, resistência, dano, cura, morte e duração das condições.
import { rollDie } from "../lib/util.js";
import { cleanConditions } from "../domain/conditions.js";
import { MAX_CONDITIONS } from "../config.js";
import { pushToken, syncSheet } from "./vision.js";
import { scheduleSave } from "../infra/storage.js";

export const DEAD = "💀";

// ---------- testes ----------
/** Rola o d20 do ataque (D&D: vantagem/desvantagem; Pathfinder 2e: penalidade de múltiplos ataques). */
export function rollAttack(system, bonus, { advantage = 0, penalty = 0 } = {}) {
  const a = rollDie(20);
  const b = rollDie(20);
  let d20 = a;
  let alt = null;
  if (system !== "pf2e" && advantage) {
    alt = b;
    d20 = advantage > 0 ? Math.max(a, b) : Math.min(a, b);
  }
  const mod = bonus + (system === "pf2e" ? penalty : 0);
  return { d20, alt, mod, total: d20 + mod };
}

const DEGREES = ["critFailure", "failure", "success", "critSuccess"];

/**
 * Grau de sucesso contra uma dificuldade (CA ou CD).
 * D&D: 20 natural sempre crítico no ataque, 1 natural sempre erra. Pathfinder 2e: ±10 muda o grau; 20/1 naturais sobem/descem um grau.
 */
export function degreeOf(system, d20, total, dc, { isAttack = true } = {}) {
  if (system !== "pf2e") {
    if (isAttack && d20 === 20) return "critSuccess";
    if (isAttack && d20 === 1) return "failure";
    return total >= dc ? "success" : "failure";
  }
  let step = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (d20 === 20) step = Math.min(3, step + 1);
  if (d20 === 1) step = Math.max(0, step - 1);
  return DEGREES[step];
}

export const isHit = (degree) => degree === "success" || degree === "critSuccess";

/** Fração do dano que o alvo recebe depois da resistência. */
export function damageFactor(system, degree, onSave) {
  if (degree === null) return 1; // magia sem teste
  if (system === "pf2e") {
    if (onSave === "none") return isHit(degree) ? 0 : 1;
    return { critSuccess: 0, success: 0.5, failure: 1, critFailure: 2 }[degree]; // resistência básica
  }
  return degree === "success" ? (onSave === "half" ? 0.5 : 0) : 1;
}

// ---------- PV e morte ----------
/** 💀 aparece sozinho quando os PV chegam a 0 e some quando voltam. Devolve true se mudou. */
export function syncDeadCondition(token, sheet) {
  const has = token.conditions.some((c) => c.e === DEAD);
  const dead = sheet.hp.max > 0 && sheet.hp.cur === 0;
  if (dead && !has && token.conditions.length < MAX_CONDITIONS) {
    token.conditions.push({ e: DEAD, d: null });
    return true;
  }
  if (!dead && has) {
    token.conditions = token.conditions.filter((c) => c.e !== DEAD);
    return true;
  }
  return false;
}

/** Depois de qualquer mudança de PV: envia a ficha, atualiza o 💀 e salva. */
export function afterHpChange(io, room, token) {
  const changed = syncDeadCondition(token, room.sheets[token.id]);
  syncSheet(io, room, token);
  if (changed) pushToken(io, room, token);
  scheduleSave(room);
}

/** PV temporário absorve primeiro. Devolve os PV finais. */
export function applyDamage(io, room, token, amount) {
  const hp = room.sheets[token.id].hp;
  const absorvido = Math.min(hp.temp, amount);
  hp.temp -= absorvido;
  hp.cur = Math.max(0, hp.cur - (amount - absorvido));
  afterHpChange(io, room, token);
  return { cur: hp.cur, max: hp.max };
}

export function applyHeal(io, room, token, amount) {
  const hp = room.sheets[token.id].hp;
  hp.cur = Math.min(hp.max, hp.cur + amount);
  afterHpChange(io, room, token);
  return { cur: hp.cur, max: hp.max };
}

// ---------- condições com duração ----------
export function addCondition(io, room, token, emoji, rounds) {
  const [nova] = cleanConditions([{ e: emoji, d: rounds || null }]);
  if (!nova) return false;
  const i = token.conditions.findIndex((c) => c.e === nova.e);
  if (i >= 0) token.conditions[i] = nova; // renova a duração
  else if (token.conditions.length < MAX_CONDITIONS) token.conditions.push(nova);
  else return false;
  pushToken(io, room, token);
  scheduleSave(room);
  return true;
}

/** Uma rodada passou: diminui 1 de cada duração e remove o que chegou a 0. */
export function tickConditions(room) {
  const expired = [];
  for (const token of Object.values(room.tokens)) {
    const keep = [];
    const gone = [];
    for (const c of token.conditions) {
      if (c.d === null) { keep.push(c); continue; }
      if (c.d - 1 <= 0) gone.push(c.e);
      else keep.push({ e: c.e, d: c.d - 1 });
    }
    if (token.conditions.some((c) => c.d !== null)) {
      token.conditions = keep;
      expired.push({ token, gone });
    }
  }
  return expired;
}
