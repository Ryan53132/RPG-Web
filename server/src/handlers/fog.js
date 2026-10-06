// Névoa de guerra (mestre).
import { isGm } from "../domain/permissions.js";
import { exploreCells, resyncVisibility, visionTokens } from "../services/vision.js";
import { scheduleSave } from "../infra/storage.js";
import { sendInitiativeAll } from "../services/initiative.js";
import { fogPayload } from "./session.js";

export function registerFog(c) {
  const { io, socket } = c;

  socket.on("fog:toggle", ({ enabled } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    room.fog.enabled = !!enabled;
    if (room.fog.enabled) for (const t of visionTokens(room)) exploreCells(room, t);
    io.to(room.id).emit("fog", fogPayload(room));
    resyncVisibility(io, room);
    sendInitiativeAll(io, room);
    scheduleSave(room);
  });

  socket.on("fog:paint", ({ cells, reveal } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid) || !Array.isArray(cells)) return;
    const valid = [];
    for (const cell of cells.slice(0, 3000)) {
      if (!Array.isArray(cell)) continue;
      const x = Math.trunc(Number(cell[0]));
      const y = Math.trunc(Number(cell[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 5000 || Math.abs(y) > 5000) continue;
      const key = `${x},${y}`;
      if (reveal) {
        room.fog.revealed.add(key);
      } else {
        room.fog.revealed.delete(key);
        room.fog.explored.delete(key); // esconder apaga também a memória da célula
      }
      valid.push([x, y]);
    }
    socket.to(room.id).emit("fog:delta", { cells: valid, reveal: !!reveal });
    resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("fog:clear", () => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    room.fog.revealed.clear();
    room.fog.explored.clear();
    for (const t of visionTokens(room)) exploreCells(room, t); // o que está iluminado agora conta como explorado
    io.to(room.id).emit("fog", fogPayload(room));
    resyncVisibility(io, room);
    scheduleSave(room);
  });
}
