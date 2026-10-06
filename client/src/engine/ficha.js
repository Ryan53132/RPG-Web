// Ficha aberta (qual token) e edição otimista: aplica na hora, manda ao servidor e ele devolve a versão validada.
import { notify, on, state } from "./state.js";
import { send } from "./net.js";
import { aviso } from "./log.js";

function mesclar(a, b) {
  for (const k of Object.keys(b)) {
    if (k === "__proto__" || k === "constructor") continue;
    const objeto = (v) => v && typeof v === "object" && !Array.isArray(v); // listas (ataques, magias) são substituídas inteiras
    if (objeto(b[k]) && objeto(a[k])) mesclar(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

export function abrirFichaDe(id) {
  const token = state.tokens[id];
  if (!token) return;
  if (!state.sheets[id]) {
    aviso(`A ficha de ${token.name} é restrita ao dono e ao mestre.`);
    return;
  }
  state.fichaId = id;
  notify("ficha");
}

export function fecharFicha() {
  if (!state.fichaId) return;
  state.fichaId = null;
  notify("ficha");
}

export function editarFicha(id, patch) {
  if (!state.sheets[id]) return;
  mesclar(state.sheets[id], patch);
  send("sheet:update", { id, patch });
  notify("sheet", id);
  notify("draw"); // a barra de PV no mapa acompanha
}

// fecha sozinha quando o token ou a ficha deixam de existir para mim
const confere = () => {
  const id = state.fichaId;
  if (id && (!state.tokens[id] || !state.sheets[id])) fecharFicha();
};
on("state:reset", fecharFicha);
on("token:gone", confere);
on("sheet:gone", confere);
on("sheets", confere);
