// Helpers de leitura da iniciativa (o estado em si vem do servidor).
import { state } from "./state.js";

export const tokenDoTurno = () => (state.initiative.turn && state.tokens[state.initiative.turn]) || null;
export const meusTokens = () => Object.values(state.tokens).filter((t) => t.owner === state.you);

export function resumoDaIniciativa() {
  const ini = state.initiative;
  if (!ini.active) return "Combate não iniciado";
  if (ini.turnHidden) return `Rodada ${ini.round}: turno de alguém fora da sua visão`;
  const t = tokenDoTurno();
  return `Rodada ${ini.round}: vez de ${t ? t.name : "—"}`;
}
