// Registro de chat, dados, combate e avisos do sistema. Fica no engine (e não num componente)
// para guardar as mensagens mesmo quando o painel ainda não está na tela.
import { notify, on } from "./state.js";

export const entradas = [];
let seq = 0;
const LIMITE = 300;

export function adicionar(entrada) {
  entradas.push({ id: ++seq, ...entrada });
  if (entradas.length > LIMITE) entradas.shift();
  notify("log");
}

export const aviso = (texto) => adicionar({ tipo: "sistema", texto });

on("chat", ({ name, text }) => adicionar({ tipo: "chat", name, text }));
on("roll", ({ name, expr, rolls, mod, total }) => adicionar({ tipo: "dado", name, expr, rolls, mod, total }));
on("combat:log", ({ lines }) => adicionar({ tipo: "combate", lines }));
