// Ferramenta ativa da barra do mestre e atalhos de névoa.
import { isGm, notify, on, state } from "./state.js";
import { send } from "./net.js";
import { getCanvas } from "./render.js";

export const tools = { atual: "mover", pincel: 3 };
export const ferramentaAtual = () => tools.atual;
export const tamanhoPincel = () => tools.pincel;

export function definirFerramenta(ferr) {
  tools.atual = ferr;
  getCanvas()?.classList.toggle("pincel", ferr !== "mover");
  if ((ferr === "revelar" || ferr === "esconder") && !state.fog.enabled) send("fog:toggle", { enabled: true }); // pintar exige névoa ligada
  notify("tool");
}

export function definirPincel(n) {
  tools.pincel = Number(n) || 1;
  notify("tool");
}

export const alternarNevoa = () => send("fog:toggle", { enabled: !state.fog.enabled });

export function cobrirTudo() {
  if (!state.fog.enabled) send("fog:toggle", { enabled: true });
  send("fog:clear");
}

// perdeu o posto de mestre: volta para a ferramenta Mover
on("players", () => { if (!isGm() && tools.atual !== "mover") definirFerramenta("mover"); });
