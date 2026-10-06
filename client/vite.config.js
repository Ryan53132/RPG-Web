import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true }, // em dev o servidor de jogo fica na porta 3001 (veja VITE_SERVER_URL)
});
