// Raiz: alterna entre a tela de entrada e a mesa, e mantém a conexão enquanto a mesa está aberta.
import { useEffect, useState } from "react";
import { connect, disconnect, on } from "./engine/index.js";
import { fecharFicha } from "./engine/ficha.js";
import Entrada from "./components/Entrada.jsx";
import Mesa from "./components/Mesa.jsx";

export default function App() {
  const [dados, setDados] = useState(null); // { sala, nome, senha, system } enquanto está na mesa
  const [ultimo, setUltimo] = useState(null); // último formulário enviado (reaparece se a senha estiver errada)
  const [erro, setErro] = useState("");

  // senha errada ou sala bloqueada: volta para a entrada com o aviso
  useEffect(
    () =>
      on("join:error", (mensagem) => {
        disconnect();
        setDados(null);
        setErro(mensagem);
      }),
    []
  );

  // a conexão vive enquanto a mesa estiver aberta (o Mapa já está montado quando isto roda)
  useEffect(() => {
    if (!dados) return undefined;
    connect(dados);
    return () => disconnect();
  }, [dados]);

  function entrar(form) {
    const nome = form.nome.trim() || "Jogador";
    const sala = form.sala.trim() || "mesa";
    localStorage.setItem("rpg-nome", nome);
    sessionStorage.setItem(`rpg-senha:${sala}`, form.senha);
    history.replaceState(null, "", `?sala=${encodeURIComponent(sala)}`);
    fecharFicha();
    setErro("");
    const novo = { sala, nome, senha: form.senha, system: form.system };
    setUltimo(novo);
    setDados(novo);
  }

  return dados ? <Mesa /> : <Entrada inicial={ultimo} erro={erro} onEntrar={entrar} />;
}
