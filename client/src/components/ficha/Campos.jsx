// Campos da ficha ligados ao caminho do valor ("hp.max", "sys.saves.fort"...).
import { CampoEntrada, CampoSelecao } from "../Campo.jsx";
import { pegar, useFicha } from "./contexto.js";

export function Num({ path, label, min, max }) {
  const { sheet, set } = useFicha();
  return (
    <label className="campo">{label}
      <CampoEntrada type="number" min={min} max={max} step={1} value={pegar(sheet, path)} onCommit={(v) => set(path, v)} />
    </label>
  );
}

export function Txt({ path, label }) {
  const { sheet, set } = useFicha();
  return (
    <label className="campo">{label}
      <CampoEntrada maxLength={30} value={pegar(sheet, path)} onCommit={(v) => set(path, v)} />
    </label>
  );
}

/** Lista suspensa; `numerico` quando o valor guardado é número (postos, dado de vida). */
export function Sel({ path, label, opcoes, numerico = false }) {
  const { sheet, set } = useFicha();
  return (
    <label className="campo">{label}
      <CampoSelecao numerico={numerico} opcoes={opcoes} value={pegar(sheet, path)} onCommit={(v) => set(path, v)} />
    </label>
  );
}

export function Chk({ path, children, className = "chk" }) {
  const { sheet, set } = useFicha();
  return (
    <label className={className}>
      <input type="checkbox" checked={!!pegar(sheet, path)} onChange={(e) => set(path, e.target.checked)} /> {children}
    </label>
  );
}

/** Valor calculado (modificador, total, CD...). */
export function Saida({ chave }) {
  const { calc } = useFicha();
  return <output>{calc[chave] ?? ""}</output>;
}
