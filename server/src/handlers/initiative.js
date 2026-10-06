// Ordem de iniciativa: adicionar, rolar, editar, iniciar combate e passar turnos.
import { MAX_INITIATIVE } from "../config.js";
import { canControl, isGm } from "../domain/permissions.js";
import { scheduleSave } from "../infra/storage.js";
import { tickConditions } from "../services/combat.js";
import { canSee, pushToken, visCtx } from "../services/vision.js";
import {
  addEntry, advance, clearAll, endCombat, removeEntry, rollFor, sendInitiativeAll, setValue, start,
} from "../services/initiative.js";

export function registerInitiative(c) {
  const { io, socket } = c;

  const done = (room) => {
    sendInitiativeAll(io, room);
    scheduleSave(room);
  };
  // Nova rodada: cada condição com duração perde 1; as que zeram saem e quem vê o token é avisado.
  const rodadaNova = (room) => {
    const expirou = tickConditions(room);
    const ctx = visCtx(room);
    for (const { token, gone } of expirou) {
      pushToken(io, room, token);
      if (!gone.length) continue;
      for (const [sid, p] of room.online) {
        if (canSee(room, p, token, ctx)) {
          io.to(sid).emit("combat:log", { lines: [{ t: `${gone.join(" ")} terminou em ${token.name}.`, k: "info" }] });
        }
      }
    }
    if (expirou.length) scheduleSave(room);
  };
  const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_INITIATIVE) : []);

  // Mestre adiciona qualquer token; jogador só os seus.
  socket.on("init:add", ({ tokenIds } = {}) => {
    const { room, pid } = c;
    if (!room) return;
    let changed = false;
    for (const id of ids(tokenIds)) {
      const t = room.tokens[id];
      if (t && canControl(room, pid, t)) changed = addEntry(room, id) || changed;
    }
    if (changed) done(room);
  });

  socket.on("init:remove", ({ tokenId } = {}) => {
    const { room, pid } = c;
    const t = room?.tokens[tokenId];
    if (!room || !t || !canControl(room, pid, t)) return;
    if (removeEntry(room, tokenId)) done(room);
  });

  socket.on("init:set", ({ tokenId, value } = {}) => {
    const { room, pid } = c;
    const t = room?.tokens[tokenId];
    if (!room || !t || !canControl(room, pid, t)) return;
    if (setValue(room, tokenId, value)) done(room);
  });

  // Rola 1d20 + modificador da ficha. NPC é anunciado só para o mestre (não revela inimigo oculto).
  socket.on("init:roll", ({ tokenIds } = {}) => {
    const { room, pid } = c;
    if (!room) return;
    let changed = false;
    for (const id of ids(tokenIds)) {
      const t = room.tokens[id];
      if (!t || !canControl(room, pid, t)) continue;
      const { roll, mod, total } = rollFor(room, id);
      changed = true;
      const msg = { name: t.name, expr: "Iniciativa", rolls: [roll], mod, total };
      for (const [sid, p] of room.online) {
        if (t.owner || isGm(room, p)) io.to(sid).emit("roll", msg);
      }
    }
    if (changed) done(room);
  });

  socket.on("init:start", () => {
    const { room, pid } = c;
    if (room && isGm(room, pid) && start(room)) done(room);
  });

  // Passar o turno: mestre, ou o dono de quem está no turno.
  socket.on("init:next", () => {
    const { room, pid } = c;
    if (!room) return;
    const turnToken = room.tokens[room.initiative.turn];
    if (!isGm(room, pid) && !(turnToken && turnToken.owner === pid)) return;
    const r = advance(room, 1);
    if (!r) return;
    if (r.newRound) rodadaNova(room);
    done(room);
  });

  socket.on("init:prev", () => {
    const { room, pid } = c;
    if (room && isGm(room, pid) && advance(room, -1)) done(room); // voltar não devolve duração de condições
  });

  socket.on("init:end", () => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    endCombat(room);
    done(room);
  });

  socket.on("init:clear", () => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    clearAll(room);
    done(room);
  });
}
