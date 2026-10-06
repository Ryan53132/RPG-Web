// A mesa em si: mapa à esquerda, painel à direita e a ficha flutuante por cima.
import Mapa from "./Mapa.jsx";
import Painel from "./painel/Painel.jsx";
import Ficha from "./ficha/Ficha.jsx";

export default function Mesa() {
  return (
    <div className="app">
      <Mapa />
      <Painel />
      <Ficha />
    </div>
  );
}
