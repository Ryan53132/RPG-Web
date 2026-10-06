// Campos que confirmam o valor ao sair do campo (ou com Enter), como o evento "change" do HTML.
// Enquanto a pessoa digita, o valor que chega do servidor não sobrescreve o rascunho.
import { useEffect, useRef, useState } from "react";

const texto = (v) => String(v ?? "");

/**
 * Entrada de texto ou número.
 *  - type="number": confirma um número (campo vazio vira 0, ou null se `anulavel`).
 *  - onCommit só é chamado quando o valor realmente mudou.
 */
export function CampoEntrada({ value, onCommit, type = "text", anulavel = false, className = "", ...resto }) {
  const ref = useRef(null);
  const [rascunho, setRascunho] = useState(texto(value));

  useEffect(() => {
    if (document.activeElement !== ref.current) setRascunho(texto(value));
  }, [value]);

  function confirmar() {
    if (type !== "number") {
      if (rascunho !== texto(value)) onCommit(rascunho);
      return;
    }
    if (anulavel && rascunho.trim() === "") {
      if (value !== null && value !== undefined) onCommit(null);
      return;
    }
    const n = Number(rascunho);
    if (!Number.isFinite(n)) { setRascunho(texto(value)); return; }
    setRascunho(String(n));
    if (n !== value) onCommit(n);
  }

  const combinada = `bg-stone-950 text-amber-100 placeholder-amber-800/60 border-2 border-amber-900/80 focus:border-amber-500 rounded px-3 py-1.5 shadow-inner transition font-serif outline-none ${className}`.trim();

  return (
    <input
      ref={ref}
      type={type}
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={combinada}
      {...resto}
    />
  );
}

/** <select> com opções [valor, rótulo]; `numerico` converte o valor escolhido em número. */
export function CampoSelecao({ value, opcoes, onCommit, numerico = false, className = "", ...resto }) {
  const combinada = `bg-stone-900 text-amber-100 border-2 border-amber-900/80 rounded px-3 py-1.5 shadow-md focus:border-amber-500 font-serif cursor-pointer outline-none ${className}`.trim();

  return (
    <select
      value={texto(value)}
      onChange={(e) => onCommit(numerico ? Number(e.target.value) : e.target.value)}
      className={combinada}
      {...resto}
    >
      {opcoes.map(([v, rotulo]) => (
        <option key={v} value={texto(v)} className="bg-stone-900 text-amber-100">
          {rotulo}
        </option>
      ))}
    </select>
  );
}