import { useEffect, useReducer } from "react";
import { on } from "../engine/index.js";

/**
 * Re-renderiza o componente quando qualquer um dos eventos do engine disparar.
 * O estado do jogo (`state`) é mutável e vive fora do React; o componente lê direto dele ao renderizar.
 * Não assine "draw" aqui: ele dispara a cada movimento do mouse (o canvas se redesenha sozinho).
 */
export function useEngine(...eventos) {
  const [, atualizar] = useReducer((n) => n + 1, 0);
  const chave = eventos.join("|");
  useEffect(() => {
    const desligar = eventos.map((e) => on(e, () => atualizar()));
    return () => desligar.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}
