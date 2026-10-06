// Chat e dados (rolados no servidor).
import { cleanStr, rollDice } from "../lib/util.js";

export function registerChat(c) {
  const { io, socket } = c;

  socket.on("chat", (text) => {
    const { room, pid } = c;
    if (!room) return;
    io.to(room.id).emit("chat", { name: room.members[pid]?.name, text: cleanStr(text, 300) });
  });

  socket.on("roll", (expr) => {
    const { room, pid } = c;
    if (!room) return;
    const name = room.members[pid]?.name;
    const result = rollDice(String(expr));
    if (!result) return socket.emit("chat", { name: "Sistema", text: "Use o formato 2d6+3" });
    io.to(room.id).emit("roll", { name, expr: cleanStr(expr, 12), ...result });
  });
}
