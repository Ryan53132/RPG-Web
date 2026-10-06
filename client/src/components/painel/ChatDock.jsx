// Chat, dados e log de combate. Sempre visível no rodapé do painel.
import { useEffect, useRef, useState } from "react";
import { send } from "../../engine/index.js";
import { entradas } from "../../engine/log.js";
import { useEngine } from "../../hooks/useEngine.js";

const DADOS = ["1d20", "1d12", "1d10", "1d8", "1d6", "1d4"];

function Entrada({ e }) {
  if (e.tipo === "chat") return <p><span className="nome font-bold text-amber-400">{e.name}:</span> {e.text}</p>;
  if (e.tipo === "sistema") return <p><span className="nome font-bold text-amber-500">Sistema:</span> {e.texto}</p>;
  if (e.tipo === "dado") {
    const mod = e.mod ? (e.mod > 0 ? ` +${e.mod}` : ` ${e.mod}`) : "";
    return (
      <p>
        <span className="nome font-bold text-amber-400">{e.name}</span> rolou <b>{e.expr}</b>: [{e.rolls.join(", ")}]{mod} ={" "}
        <span className="dado text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60"><b>{e.total}</b></span>
      </p>
    );
  }
  return (
    <p>
      {e.lines.map((l, i) => (
        <span key={i}>
          {i > 0 && <br />}
          <span className={`cl ${l.k}`}>{l.t}</span>
        </span>
      ))}
    </p>
  );
}

export default function ChatDock() {
  useEngine("log");
  const [aberto, setAberto] = useState(true);
  const [texto, setTexto] = useState("");
  const fim = useRef(null);

  useEffect(() => {
    const el = fim.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entradas.at(-1)?.id, aberto]);

  function enviar(e) {
    if (e.key !== "Enter") return;
    const v = texto.trim();
    if (!v) return;
    if (/^\/r\s+/i.test(v)) send("roll", v.replace(/^\/r\s+/i, ""));
    else send("chat", v);
    setTexto("");
  }

  return (
    <section className="chat-dock bg-stone-950/95 border-t-2 border-amber-950 text-amber-100 font-serif shadow-2xl transition-all">
      <div className="chat-topo flex items-center justify-between px-3 py-2 bg-stone-900 border-b border-amber-950">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Dados e chat</h3>
        <button
          className="sec peq px-2.5 py-0.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded transition cursor-pointer"
          aria-expanded={aberto}
          aria-controls="chat-corpo"
          onClick={() => setAberto(!aberto)}
        >
          {aberto ? "Recolher" : "Abrir"}
        </button>
      </div>
      <div id="chat-corpo" className="p-2 space-y-2" hidden={!aberto}>
        <div className="log max-h-48 min-h-[6rem] overflow-y-auto bg-stone-950/90 border border-amber-950/80 rounded-lg p-2.5 text-xs font-sans space-y-1.5 shadow-inner leading-relaxed" aria-live="polite" ref={fim}>
          {entradas.map((e) => <Entrada key={e.id} e={e} />)}
        </div>
        <input
          placeholder="Mensagem ou /r 2d6+3"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={enviar}
          className="w-full bg-stone-950 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-3 py-1.5 text-xs font-sans outline-none shadow-inner"
        />
        <div className="dados flex items-center gap-1.5 justify-between pt-1">
          {DADOS.map((d) => (
            <button
              key={d}
              onClick={() => send("roll", d)}
              className="flex-1 py-1 bg-stone-900 hover:bg-amber-950 text-amber-200 hover:text-amber-100 border border-amber-900/60 hover:border-amber-600 rounded text-xs font-semibold transition cursor-pointer shadow-sm text-center"
            >
              {d.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}