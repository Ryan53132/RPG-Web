// Janela flutuante da ficha do token com suporte a sanfona e redimensionamento corrigido.
import { useRef, useState } from "react";
import { send, state } from "../../engine/index.js";
import { editarFicha, fecharFicha } from "../../engine/ficha.js";
import { ATTRS, calcularFicha } from "../../engine/rules.js";
import { useEngine } from "../../hooks/useEngine.js";
import { CampoEntrada } from "../Campo.jsx";
import { Num, Saida, Sel } from "./Campos.jsx";
import { Ataques, Magias } from "./ListasCombate.jsx";
import { Origem, SecaoDnd, SecaoPf2e } from "./SecoesSistema.jsx";
import { FichaCtx, aninhar, useFicha } from "./contexto.js";

let ultimaPosicao = null;

function SecaoSanfona({ titulo, children, abertoInicial = true }) {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <fieldset className="border border-amber-900/60 bg-stone-950/40 rounded-lg p-3 space-y-2 mb-3">
      <legend
        onClick={() => setAberto(!aberto)}
        className="text-xs font-bold text-amber-400 uppercase tracking-wider px-2 cursor-pointer select-none hover:text-amber-300 transition flex items-center gap-1.5"
      >
        <span>{aberto ? "▼" : "▶"}</span>
        <span>{titulo}</span>
      </legend>
      {aberto && children}
    </fieldset>
  );
}

function HpRapido() {
  const { sheet, patch } = useFicha();
  const [valor, setValor] = useState("");

  function aplicar(tipo) {
    const n = Math.trunc(Number(valor));
    if (!(n > 0)) return;
    const { max, cur, temp } = sheet.hp;
    let novoCur = cur, novoTemp = temp;
    if (tipo === "dano") {
      const absorvido = Math.min(temp, n);
      novoTemp = temp - absorvido;
      novoCur = Math.max(0, cur - (n - absorvido));
    } else {
      novoCur = Math.min(max, cur + n);
    }
    setValor("");
    patch({ hp: { cur: novoCur, temp: novoTemp } });
  }

  return (
    <div className="hp-rapido flex items-center gap-2 mt-2">
      <input
        type="number"
        min="1"
        placeholder="Valor"
        aria-label="Valor de dano ou cura"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-20 bg-stone-900 border border-amber-900/80 text-amber-100 rounded px-2 py-1 text-xs outline-none"
      />
      <button type="button" className="sec px-2 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded cursor-pointer" onClick={() => aplicar("dano")}>
        Dano
      </button>
      <button type="button" className="sec px-2 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded cursor-pointer" onClick={() => aplicar("cura")}>
        Cura
      </button>
    </div>
  );
}

function Corpo({ token }) {
  const { system } = useFicha();
  const alinhamentos = [["", "—"], ...state.alignments.map((a) => [a, a])];

  return (
    <div className="ficha-corpo p-3 space-y-2 h-[calc(100%-3rem)] overflow-y-auto">
      <SecaoSanfona titulo="Identidade">
        <label className="campo flex flex-col gap-1 text-xs font-semibold text-amber-200">
          Nome
          <CampoEntrada
            maxLength={20}
            value={token.name}
            onCommit={(v) => v.trim() && send("token:update", { id: token.id, name: v.trim() })}
          />
        </label>
        <div className="grade2 grid grid-cols-2 gap-2 mt-2">
          <Num path="level" label="Nível" min={1} max={20} />
          <Sel path="alignment" label="Tendência" opcoes={alinhamentos} />
        </div>
        <div className="grade2 grid grid-cols-2 gap-2 mt-2">
          <Origem system={system} />
        </div>
      </SecaoSanfona>

      <SecaoSanfona titulo="Atributos">
        <div className="grade3 atributos grid grid-cols-3 gap-2">
          {ATTRS.map(([k, l]) => (
            <AtributoCard key={k} chave={k} rotulo={l} />
          ))}
        </div>
      </SecaoSanfona>

      <SecaoSanfona titulo="Combate">
        <div className="grade3 grid grid-cols-3 gap-2">
          <Num path="hp.max" label="PV máx." min={0} max={9999} />
          <Num path="hp.cur" label="PV atual" min={0} max={9999} />
          <Num path="hp.temp" label="PV temp." min={0} max={999} />
        </div>
        <HpRapido />
        <div className="grade3 grid grid-cols-2 gap-2 mt-2">
          <Num path="ac" label="CA base" min={0} max={99} />
          <Num path="speed" label="Deslocamento (ft)" min={0} max={999} />
        </div>
      </SecaoSanfona>

      <SecaoSanfona titulo={system === "pf2e" ? "Perícias e Testes (Pathfinder 2e)" : "Proficiências e Recursos (D&D 5e)"}>
        {system === "pf2e" ? <SecaoPf2e /> : <SecaoDnd />}
      </SecaoSanfona>

      <SecaoSanfona titulo="Ataques" abertoInicial={false}>
        <Ataques />
      </SecaoSanfona>

      <SecaoSanfona titulo="Magias" abertoInicial={false}>
        <Magias />
      </SecaoSanfona>

      <SecaoSanfona titulo="Notas" abertoInicial={false}>
        <NotasCampo />
      </SecaoSanfona>
    </div>
  );
}

function AtributoCard({ chave, rotulo }) {
  const { sheet, set } = useFicha();
  return (
    <label className="attr flex flex-col text-xs font-semibold text-amber-200">
      <span>{rotulo}</span>
      <CampoEntrada type="number" min={1} max={30} step={1} value={sheet.attrs[chave]} onCommit={(v) => set(`attrs.${chave}`, v)} />
      <Saida chave={`mod.${chave}`} />
    </label>
  );
}

function NotasCampo() {
  const { sheet, set } = useFicha();
  return <NotasTexto value={sheet.notes} onCommit={(v) => set("notes", v)} />;
}

function NotasTexto({ value, onCommit }) {
  const [rascunho, setRascunho] = useState(value ?? "");
  const [foco, setFoco] = useState(false);
  const mostrado = foco ? rascunho : value ?? "";
  return (
    <textarea
      rows={4}
      maxLength={2000}
      aria-label="Notas"
      value={mostrado}
      className="w-full bg-stone-900 border border-amber-900/80 text-amber-100 rounded p-2 text-xs outline-none focus:border-amber-500 font-sans"
      onFocus={() => { setRascunho(value ?? ""); setFoco(true); }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => { setFoco(false); if (rascunho !== (value ?? "")) onCommit(rascunho); }}
    />
  );
}

function Janela({ id, token, sheet }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(ultimaPosicao);
  const [minimizado, setMinimizado] = useState(false);

  const contexto = {
    id,
    sheet,
    system: state.system,
    calc: calcularFicha(state.system, sheet),
    set: (caminho, valor) => editarFicha(id, aninhar(caminho, valor)),
    patch: (patch) => editarFicha(id, patch),
  };

  function arrastar(e) {
    if (e.target.closest("button")) return;
    const cab = e.currentTarget;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    cab.setPointerCapture(e.pointerId);
    const mover = (ev) => {
      const nova = {
        left: Math.min(innerWidth - 60, Math.max(60 - r.width, ev.clientX - dx)),
        top: Math.min(innerHeight - 40, Math.max(0, ev.clientY - dy)),
      };
      ultimaPosicao = nova;
      setPos(nova);
    };
    const soltar = () => {
      cab.removeEventListener("pointermove", mover);
      cab.removeEventListener("pointerup", soltar);
    };
    cab.addEventListener("pointermove", mover);
    cab.addEventListener("pointerup", soltar);
  }

  const estiloJanela = {
    ...(pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : {}),
    ...(minimizado ? { height: "auto", minHeight: "0px" } : {}),
  };

  return (
    <div
      className={`ficha absolute z-50 bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl shadow-2xl text-amber-100 font-serif backdrop-blur-md ${
        minimizado
          ? "w-80 !h-auto !min-h-0 !max-h-none overflow-hidden !resize-none"
          : "w-96 h-[80vh] min-w-[20rem] min-h-[12rem] max-w-[90vw] max-h-[90vh] resize overflow-auto"
      }`}
      role="dialog"
      aria-labelledby="ficha-titulo"
      ref={ref}
      style={estiloJanela}
    >
      <header
        className="ficha-cabecalho flex items-center justify-between p-3 bg-stone-950/90 border-b border-amber-950 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={arrastar}
      >
        <h2 id="ficha-titulo" className="text-sm font-bold text-amber-400 truncate">
          {token.name ? `Ficha: ${token.name}` : "Ficha"}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-stone-800 hover:bg-stone-700 text-amber-200 rounded border border-amber-900/60 transition cursor-pointer"
            title={minimizado ? "Expandir ficha" : "Minimizar ficha"}
            onClick={() => setMinimizado(!minimizado)}
          >
            {minimizado ? "□" : "−"}
          </button>
          <button
            type="button"
            className="ficha-x w-6 h-6 flex items-center justify-center text-xs font-bold bg-stone-800 hover:bg-red-950/80 hover:text-red-300 text-amber-200 rounded border border-amber-900/60 transition cursor-pointer"
            aria-label="Fechar ficha"
            onClick={fecharFicha}
          >
            &times;
          </button>
        </div>
      </header>

      {!minimizado && (
        <FichaCtx.Provider value={contexto}>
          <Corpo token={token} />
        </FichaCtx.Provider>
      )}
    </div>
  );
}

export default function Ficha() {
  useEngine("ficha", "sheet", "sheets", "sheet:gone", "token:upsert", "token:gone", "state:reset");
  const id = state.fichaId;
  const token = id && state.tokens[id];
  const sheet = id && state.sheets[id];
  if (!token || !sheet) return null;
  return <Janela key={id} id={id} token={token} sheet={sheet} />;
}