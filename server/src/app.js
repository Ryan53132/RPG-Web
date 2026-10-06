// Liga cada grupo de eventos do Socket.IO. Recebe o `io` pronto, então os testes podem passar um falso.
import { registerSession } from "./handlers/session.js";
import { registerTokens } from "./handlers/tokens.js";
import { registerSheets } from "./handlers/sheets.js";
import { registerWalls } from "./handlers/walls.js";
import { registerFog } from "./handlers/fog.js";
import { registerGrid } from "./handlers/grid.js";
import { registerInitiative } from "./handlers/initiative.js";
import { registerCombat } from "./handlers/combat.js";
import { registerChat } from "./handlers/chat.js";

export function registerHandlers(io) {
  io.on("connection", (socket) => {
    // contexto da conexão: preenchido no "join" e lido pelos handlers
    const c = { io, socket, room: null, pid: null };
    registerSession(c);
    registerTokens(c);
    registerSheets(c);
    registerWalls(c);
    registerFog(c);
    registerGrid(c);
    registerInitiative(c);
    registerCombat(c);
    registerChat(c);
  });
}
