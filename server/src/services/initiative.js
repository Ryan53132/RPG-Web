// Ordem de iniciativa: estado puro + envio filtrado pela visão de cada jogador.
import { MAX_INITIATIVE } from "../config.js";
import { initiativeMod } from "../domain/rules.js";
import { rollDie } from "../lib/util.js";
import { isGm } from "../domain/permissions.js";
import { canSee, hooks, visCtx } from "./vision.js";

export const newInitiative = () => ({ entries: [], turn: null, round: 1, active: false, seq: 0 });

const find = (room, tokenId) => room.initiative.entries.find((e) => e.tokenId === tokenId);

/** Maior valor primeiro; sem valor vai para o fim; empate mantém a ordem de entrada. */
function sortEntries(room) {
  room.initiative.entries.sort((a, b) => {
    if (a.value === null && b.value === null) return a.seq - b.seq;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value || a.seq - b.seq;
  });
}

export function addEntry(room, tokenId) {
  const init = room.initiative;
  if (!room.tokens[tokenId] || find(room, tokenId) || init.entries.length >= MAX_INITIATIVE) return false;
  init.entries.push({ tokenId, value: null, seq: ++init.seq });
  sortEntries(room);
  return true;
}

export function setValue(room, tokenId, value) {
  const entry = find(room, tokenId);
  if (!entry) return false;
  const n = Math.trunc(Number(value));
  entry.value = value === null || value === "" || !Number.isFinite(n) ? null : Math.max(-99, Math.min(999, n));
  sortEntries(room);
  return true;
}

export function removeEntry(room, tokenId) {
  const init = room.initiative;
  const i = init.entries.findIndex((e) => e.tokenId === tokenId);
  if (i < 0) return false;
  const eraOTurno = init.turn === tokenId;
  init.entries.splice(i, 1);
  if (!init.entries.length) {
    init.active = false;
    init.turn = null;
    init.round = 1;
  } else if (eraOTurno) {
    init.turn = init.entries[Math.min(i, init.entries.length - 1)].tokenId; // passa para quem veio depois
  }
  return true;
}

export function start(room) {
  const init = room.initiative;
  if (!init.entries.length) return false;
  sortEntries(room);
  init.active = true;
  init.round = 1;
  init.turn = init.entries[0].tokenId;
  return true;
}

/** Passa o turno. Devolve null se não deu, ou { newRound } (true quando uma nova rodada começou). */
export function advance(room, dir) {
  const init = room.initiative;
  if (!init.active || !init.entries.length) return null;
  let i = init.entries.findIndex((e) => e.tokenId === init.turn);
  if (i < 0) i = 0;
  let n = i + dir;
  let newRound = false;
  if (n >= init.entries.length) { n = 0; init.round += 1; newRound = true; }
  if (n < 0) { n = init.entries.length - 1; init.round = Math.max(1, init.round - 1); }
  init.turn = init.entries[n].tokenId;
  return { newRound };
}

export function endCombat(room) {
  Object.assign(room.initiative, { active: false, turn: null, round: 1 }); // mantém a lista e os valores
}

export function clearAll(room) {
  room.initiative = newInitiative();
}

/** Rola 1d20 + modificador da ficha e grava o resultado. */
export function rollFor(room, tokenId) {
  const mod = initiativeMod(room.system, room.sheets[tokenId]);
  const roll = rollDie(20);
  addEntry(room, tokenId);
  setValue(room, tokenId, roll + mod);
  return { roll, mod, total: roll + mod };
}

// ---------- visão de cada jogador ----------
export function initiativeView(room, pid) {
  const init = room.initiative;
  const gm = isGm(room, pid);
  const ctx = gm || !room.fog.enabled ? null : visCtx(room);
  const visible = (id) => {
    const t = room.tokens[id];
    return !!t && (gm || !ctx || canSee(room, pid, t, ctx));
  };
  return {
    active: init.active,
    round: init.round,
    turn: visible(init.turn) ? init.turn : null,
    turnHidden: init.active && !!init.turn && !visible(init.turn), // é a vez de alguém que o jogador não vê
    entries: init.entries.filter((e) => visible(e.tokenId)).map(({ tokenId, value }) => ({ tokenId, value })),
  };
}

export function sendInitiativeTo(io, room, sid) {
  const pid = room.online.get(sid);
  if (pid) io.to(sid).emit("initiative", initiativeView(room, pid));
}

export function sendInitiativeAll(io, room) {
  for (const sid of room.online.keys()) sendInitiativeTo(io, room, sid);
}

// Quando um token da lista entra/sai da visão de alguém, só esse cliente recebe a lista de novo.
hooks.transition = (io, room, sid, tokenId) => {
  if (find(room, tokenId)) sendInitiativeTo(io, room, sid);
};
