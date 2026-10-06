// Condições dos tokens: paleta sugerida (emoji + nome). O jogador também pode digitar outro emoji.
export const CONDICOES = [
  ["😵", "Atordoado"], ["😴", "Dormindo"], ["💤", "Inconsciente"], ["🤢", "Envenenado"],
  ["🔥", "Queimando"], ["🥶", "Congelado"], ["😱", "Amedrontado"], ["🙈", "Cego"],
  ["🔇", "Silenciado"], ["⛓️", "Agarrado"], ["🕸️", "Preso"], ["🩸", "Sangrando"],
  ["💀", "Morrendo"], ["🛡️", "Em guarda"], ["✨", "Abençoado"], ["👻", "Invisível"],
  ["😵‍💫", "Confuso"], ["🧊", "Paralisado"], ["⚡", "Eletrizado"], ["❤️‍🔥", "Enfeitiçado"],
];
export const nomeDaCondicao = (emoji) => CONDICOES.find(([e]) => e === emoji)?.[1] ?? "Condição personalizada";
