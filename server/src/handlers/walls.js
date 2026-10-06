// Paredes e portas (mestre).
import { randomUUID } from "crypto";
import { MAX_WALLS } from "../config.js";
import { isGm } from "../domain/permissions.js";
import { exploreAll, resyncVisibility } from "../services/vision.js";
import { scheduleSave } from "../infra/storage.js";

export function registerWalls(c) {
  const { io, socket } = c;

  socket.on("wall:add", (w = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid) || room.walls.length >= MAX_WALLS) return;
    const coords = [w.x1, w.y1, w.x2, w.y2].map((n) => {
      const v = Math.round(Number(n));
      return Number.isFinite(v) && Math.abs(v) <= 5000 ? v : null;
    });
    if (coords.includes(null)) return;
    const [x1, y1, x2, y2] = coords;
    if ((x1 === x2 && y1 === y2) || Math.hypot(x2 - x1, y2 - y1) > 400) return;
    const dup = room.walls.some(
      (o) =>
        (o.x1 === x1 && o.y1 === y1 && o.x2 === x2 && o.y2 === y2) ||
        (o.x1 === x2 && o.y1 === y2 && o.x2 === x1 && o.y2 === y1)
    );
    if (dup) return;
    const wall = { id: randomUUID(), x1, y1, x2, y2, door: !!w.door, open: false };
    room.walls.push(wall);
    io.to(room.id).emit("wall:added", wall);
    resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("wall:remove", (id) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    const before = room.walls.length;
    room.walls = room.walls.filter((w) => w.id !== id);
    if (room.walls.length === before) return;
    io.to(room.id).emit("wall:removed", id);
    exploreAll(io, room); // sem a parede, mais área pode ficar visível
    resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("wall:toggle", (id) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    const wall = room.walls.find((w) => w.id === id);
    if (!wall || !wall.door) return;
    wall.open = !wall.open;
    io.to(room.id).emit("wall:updated", wall);
    exploreAll(io, room);
    resyncVisibility(io, room);
    scheduleSave(room);
  });

  socket.on("wall:clear", () => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    room.walls = [];
    io.to(room.id).emit("walls", []);
    exploreAll(io, room);
    resyncVisibility(io, room);
    scheduleSave(room);
  });
}
