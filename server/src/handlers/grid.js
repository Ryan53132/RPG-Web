// Tamanho da casa e imagem do mapa (mestre).
import { clamp, cleanStr, validBg } from "../lib/util.js";
import { isGm } from "../domain/permissions.js";
import { scheduleSave } from "../infra/storage.js";

export function registerGrid(c) {
  const { io, socket } = c;

  socket.on("grid:update", ({ size, bg, bgScale } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    const cleanBg = cleanStr(bg, 500);
    room.grid = {
      size: clamp(size, 20, 200) || 50,
      bg: validBg(cleanBg) ? cleanBg : "",
      bgScale: clamp(bgScale, 10, 500) || 100,
    };
    io.to(room.id).emit("grid:updated", room.grid);
    scheduleSave(room);
  });
}
