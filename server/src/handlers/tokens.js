// Criar, mover, editar e remover tokens (inclui condições em emoji).
import { randomUUID } from "crypto";
import { DEFAULT_PLAYER_VISION, MAX_TOKENS } from "../config.js";
import { clamp, cleanColor, cleanStr, clampVision, finite } from "../lib/util.js";
import { defaultSheet } from "../domain/rules.js";
import { cleanConditions } from "../domain/conditions.js";
import { canControl, isGm } from "../domain/permissions.js";
import { exploreAndEmit, pushToken, resyncVisibility, syncSheet } from "../services/vision.js";
import { removeEntry, sendInitiativeAll } from "../services/initiative.js";
import { scheduleSave } from "../infra/storage.js";

export function registerTokens(c) {
  const { io, socket } = c;

  socket.on("token:add", (t = {}) => {
    const { room, pid } = c;
    if (!room || Object.keys(room.tokens).length >= MAX_TOKENS) return;
    const gm = isGm(room, pid);
    // Jogador: token sempre dele. Mestre: escolhe o dono (vazio = NPC do mestre).
    const owner = gm ? (room.members[t.owner] ? t.owner : null) : pid;
    // Visão: jogador sempre recebe o padrão; só o mestre escolhe (ou "auto").
    const vision = gm && t.vision !== undefined && t.vision !== "auto"
      ? clampVision(t.vision)
      : owner ? DEFAULT_PLAYER_VISION : 0;
    const token = {
      id: randomUUID(),
      name: cleanStr(t.name, 20) || "Token",
      color: cleanColor(t.color),
      size: clamp(t.size, 1, 6) || 1,
      x: clamp(t.x, -100000, 100000),
      y: clamp(t.y, -100000, 100000),
      owner,
      vision,
      conditions: [],
    };
    room.tokens[token.id] = token;
    room.sheets[token.id] = defaultSheet(room.system);
    syncSheet(io, room, token);
    exploreAndEmit(io, room, token);
    pushToken(io, room, token);
    if (token.vision > 0) resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("token:move", ({ id, x, y } = {}) => {
    const { room, pid } = c;
    if (!room) return;
    const token = room.tokens[id];
    if (!token || !canControl(room, pid, token) || !finite(x) || !finite(y)) return;
    token.x = clamp(x, -100000, 100000);
    token.y = clamp(y, -100000, 100000);
    exploreAndEmit(io, room, token);
    pushToken(io, room, token, socket.id);
    if (token.vision > 0) resyncVisibility(io, room); // a luz mudou: revela/esconde outros tokens
    scheduleSave(room);
  });

  socket.on("token:update", ({ id, name, color, size, owner, vision, conditions } = {}) => {
    const { room, pid } = c;
    if (!room) return;
    const token = room.tokens[id];
    if (!token || !canControl(room, pid, token)) return;
    const gm = isGm(room, pid);
    if (name !== undefined) token.name = cleanStr(name, 20) || token.name;
    if (color !== undefined) token.color = cleanColor(color);
    if (size !== undefined) token.size = clamp(size, 1, 6) || token.size;
    if (conditions !== undefined) token.conditions = cleanConditions(conditions);
    const donoAntes = token.owner;
    if (gm && owner !== undefined) token.owner = room.members[owner] ? owner : null;
    if (gm && vision !== undefined) token.vision = clampVision(vision);
    if (token.owner !== donoAntes) syncSheet(io, room, token); // ficha acompanha o novo dono
    exploreAndEmit(io, room, token);
    pushToken(io, room, token);
    resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("token:remove", (id) => {
    const { room, pid } = c;
    if (!room) return;
    const token = room.tokens[id];
    if (!token || !canControl(room, pid, token)) return;
    delete room.tokens[id];
    delete room.sheets[id];
    for (const sent of room.sent.values()) sent.delete(id);
    io.to(room.id).emit("token:gone", id);
    if (removeEntry(room, id)) sendInitiativeAll(io, room);
    if (token.vision > 0) resyncVisibility(io, room);
    scheduleSave(room);
  });
}
