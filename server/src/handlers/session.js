// Entrar na sala, sair, senha e troca de mestre.
import { randomUUID } from "crypto";
import { ALIGNMENTS, SYSTEMS } from "../domain/rules.js";
import { cleanRoomId, cleanStr, validPid } from "../lib/util.js";
import { clearFails, clientIp, hashPassword, lockedSeconds, registerFail, verifyPassword } from "../infra/password.js";
import { createRoom, loadRoom, scheduleSave, unloadRoom } from "../infra/storage.js";
import { isGm } from "../domain/permissions.js";
import { resyncVisibility, sheetsFor, tokensFor } from "../services/vision.js";
import { initiativeView, sendInitiativeAll } from "../services/initiative.js";

export const fogPayload = (room) => ({
  enabled: room.fog.enabled,
  revealed: [...room.fog.revealed],
  explored: [...room.fog.explored],
});

export const playersPayload = (room) => ({
  gmId: room.gmId,
  locked: !!room.passwordHash,
  autoDamage: room.autoDamage,
  online: [...new Set(room.online.values())],
  members: room.members,
});

export function registerSession(c) {
  const { io, socket } = c;

  socket.on("join", ({ room: rawRoom, name, playerId, password, system } = {}) => {
    if (c.room) return;
    const id = cleanRoomId(rawRoom);
    const pw = cleanStr(password, 64);
    const key = `${clientIp(socket)}|${id}`;

    const wait = lockedSeconds(key);
    if (wait) return socket.emit("join:error", { message: `Muitas tentativas. Aguarde ${wait}s e tente de novo.` });

    const pid = validPid(playerId) ? playerId : randomUUID();
    let target = loadRoom(id);
    if (target) {
      if (target.passwordHash && !verifyPassword(pw, target.passwordHash)) {
        if (pw) registerFail(key); // senha em branco não conta como tentativa
        return socket.emit("join:error", { message: pw ? "Senha incorreta." : "Esta sala exige senha." });
      }
    } else {
      if (pw && pw.length < 4) {
        return socket.emit("join:error", { message: "Para criar a sala com senha, use pelo menos 4 caracteres." });
      }
      target = createRoom(id, pid, SYSTEMS[system] ? system : "dnd5e"); // criador = mestre; define senha e sistema
      if (pw) target.passwordHash = hashPassword(pw);
    }
    clearFails(key);

    c.pid = pid;
    c.room = target;
    const room = target;
    room.members[pid] = { name: cleanStr(name, 20) || "Jogador" };
    room.online.set(socket.id, pid);
    const visible = tokensFor(room, pid);
    room.sent.set(socket.id, new Set(Object.keys(visible)));
    socket.join(id);

    socket.emit("state", {
      room: id,
      you: pid,
      system: room.system,
      alignments: ALIGNMENTS,
      tokens: visible,
      sheets: sheetsFor(room, pid),
      walls: room.walls,
      grid: room.grid,
      fog: fogPayload(room),
      initiative: initiativeView(room, pid),
      players: playersPayload(room),
    });
    socket.to(id).emit("players", playersPayload(room));
    scheduleSave(room);
  });

  // ---------- Senha da sala (mestre) ----------
  socket.on("room:password", ({ password } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    const pw = cleanStr(password, 64);
    if (pw && pw.length < 4) {
      return socket.emit("chat", { name: "Sistema", text: "Use uma senha com pelo menos 4 caracteres." });
    }
    room.passwordHash = pw ? hashPassword(pw) : null; // quem já está na sala continua dentro
    io.to(room.id).emit("players", playersPayload(room));
    scheduleSave(room);
  });

  // ---------- Transferir mestre ----------
  socket.on("gm:transfer", ({ to } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid) || !room.members[to] || to === pid) return;
    room.gmId = to;
    io.to(room.id).emit("players", playersPayload(room));
    for (const [sid, p] of room.online) io.to(sid).emit("sheets", { sheets: sheetsFor(room, p) });
    resyncVisibility(io, room); // a visibilidade muda junto com o papel
    sendInitiativeAll(io, room);
    scheduleSave(room);
  });

  socket.on("disconnect", () => {
    const { room } = c;
    if (!room) return;
    room.online.delete(socket.id);
    room.sent.delete(socket.id);
    if (room.online.size === 0) return unloadRoom(room);
    io.to(room.id).emit("players", playersPayload(room));
  });
}
