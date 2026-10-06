// Painel lateral: título da sala, jogadores online, abas e o chat sempre visível.
import { useState } from "react";
import { isGm, send, SISTEMAS, state } from "../../engine/index.js";
import { useEngine } from "../../hooks/useEngine.js";
import AbaToken from "./AbaToken.jsx";
import AbaIniciativa from "./AbaIniciativa.jsx";
import AbaMestre from "./AbaMestre.jsx";
import ChatDock from "./ChatDock.jsx";

function Jogadores() {
  const gm = isGm();
  return (
    <div className="jogadores flex flex-wrap gap-1 text-xs">
      {state.online.map((id) => {
        const ehMestre = id === state.gmId;
        const podeTransferir = gm && id !== state.you;
        const nome = state.members[id]?.name;
        return (
          <span
            key={id}
            className={`jogador ${ehMestre ? "mestre bg-amber-950 text-amber-300 border border-amber-700/60 font-semibold" : "bg-stone-800/80 text-amber-200/90 border border-stone-700/50"} ${
              podeTransferir ? "transferivel hover:border-amber-500 hover:bg-stone-700 cursor-pointer" : ""
            } px-2 py-0.5 rounded text-[11px] font-sans font-medium transition`}
            title={podeTransferir ? "Clique para passar o posto de mestre" : undefined}
            onClick={() => podeTransferir && confirm(`Passar o posto de mestre para ${nome}?`) && send("gm:transfer", { to: id })}
          >
            {nome}{ehMestre ? " (mestre)" : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function Painel() {
  useEngine("players", "state:reset");
  const [aba, setAba] = useState("token");
  const gm = isGm();
  const atual = aba === "mestre" && !gm ? "token" : aba;

  const abas = [["token", "Token"], ["iniciativa", "Iniciativa"], ...(gm ? [["mestre", "Mestre"]] : [])];

  return (
    <aside className="painel w-80 min-w-[20rem] h-full bg-stone-900/95 border-l-2 border-amber-950 text-amber-100 font-serif flex flex-col justify-between shadow-2xl backdrop-blur-md overflow-hidden">
      <header className="painel-topo p-3 bg-stone-950/80 border-b border-amber-950 shadow-inner space-y-2">
        <h2 className="text-sm font-bold text-amber-400 tracking-wide border-b border-amber-950/60 pb-1">
          Sala: {state.room} ({SISTEMAS[state.system]}){state.locked ? " (com senha)" : ""}
        </h2>
        <Jogadores />
      </header>

      <nav className="abas flex border-b border-amber-950 bg-stone-950/40" role="tablist" aria-label="Painel">
        {abas.map(([id, rotulo]) => (
          <button
            key={id}
            role="tab"
            aria-selected={atual === id}
            onClick={() => setAba(id)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition border-b-2 cursor-pointer ${
              atual === id
                ? "bg-stone-900 text-amber-300 border-amber-500 shadow-sm"
                : "text-amber-200/60 hover:text-amber-100 border-transparent hover:bg-stone-900/50"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      <div className="abas-corpo flex-1 overflow-y-auto p-3 space-y-3 shadow-inner">
        <section className="aba" role="tabpanel" hidden={atual !== "token"}><AbaToken /></section>
        <section className="aba" role="tabpanel" hidden={atual !== "iniciativa"}><AbaIniciativa /></section>
        {gm && <section className="aba" role="tabpanel" hidden={atual !== "mestre"}><AbaMestre /></section>}
      </div>

      <ChatDock />
    </aside>
  );
}