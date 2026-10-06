// Garante que os arquivos duplicados entre servidor e cliente continuam idênticos.
// (As pastas são imagens Docker separadas, então não dá para compartilhar um import.)
import fs from "fs";

const PARES = [["server/src/domain/areas.js", "client/src/engine/areas.js"]];
let falhou = false;
for (const [a, b] of PARES) {
  const igual = fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8");
  console.log(`${igual ? "ok" : "DIFERENTE"} - ${a} == ${b}`);
  if (!igual) falhou = true;
}
process.exit(falhou ? 1 : 0);
