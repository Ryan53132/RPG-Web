// Ponto único de entrada do engine: importar este arquivo registra todos os ouvintes de eventos.
// Os componentes React importam daqui (ou dos módulos específicos) e nunca tocam o DOM do mapa.
import "./log.js";
import "./ficha.js";
import "./tools.js";
import "./mira.js";

export * from "./state.js";
export { connect, disconnect, send, assetUrl, SERVER_URL } from "./net.js";
export { attachCanvas, getCanvas, resize } from "./render.js";
export { attachInput } from "./input.js";
export { toWorld } from "./geometry.js";
