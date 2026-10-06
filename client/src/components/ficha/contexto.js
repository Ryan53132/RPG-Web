import { createContext, useContext } from "react";

/** { id, sheet, system, calc, set(caminho, valor), patch(objeto) } entregue pela janela da ficha. */
export const FichaCtx = createContext(null);
export const useFicha = () => useContext(FichaCtx);

export const pegar = (obj, caminho) => caminho.split(".").reduce((a, k) => (a == null ? undefined : a[k]), obj);
export const aninhar = (caminho, valor) => caminho.split(".").reduceRight((acc, k) => ({ [k]: acc }), valor);
