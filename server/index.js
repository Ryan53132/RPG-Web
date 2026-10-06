// Ponto de entrada: sobe o HTTP + Socket.IO e registra os handlers (veja src/app.js).
import { createServer } from "http";
import { Server } from "socket.io";
import { DATA_DIR, PORT } from "./src/config.js";
import { ensureDirs, flushAll } from "./src/infra/storage.js";
import { handleHttp, startCleanup } from "./src/infra/uploads.js";
import { registerHandlers } from "./src/app.js";

ensureDirs();
startCleanup();

const httpServer = createServer(handleHttp);
const io = new Server(httpServer, { cors: { origin: true } });
registerHandlers(io);

function shutdown() {
  flushAll(); // docker stop: grava tudo antes de sair
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

httpServer.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT} (dados em ${DATA_DIR})`));
