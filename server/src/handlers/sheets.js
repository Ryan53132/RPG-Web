// Ficha do token (dono e mestre).
import { isPlain, mergeDeep } from "../lib/util.js";
import { defaultSheet, normalizeSheet } from "../domain/rules.js";
import { canControl } from "../domain/permissions.js";
import { afterHpChange } from "../services/combat.js";

export function registerSheets(c) {
  const { io, socket } = c;

  socket.on("sheet:update", ({ id, patch } = {}) => {
    const { room, pid } = c;
    if (!room || !isPlain(patch)) return;
    const token = room.tokens[id];
    if (!token || !canControl(room, pid, token)) return;
    room.sheets[id] = normalizeSheet(room.system, mergeDeep(room.sheets[id] || defaultSheet(room.system), patch));
    afterHpChange(io, room, token); // devolve a ficha validada, ajusta o 💀 e salva
  });
}
