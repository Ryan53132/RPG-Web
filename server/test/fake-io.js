// Socket.IO falso, síncrono e em memória: permite testar os handlers sem rede nem a biblioteca.
// Uso: const io = new FakeIO(); registerHandlers(io); const gm = io.connect(); gm.send("join", {...}); gm.events("state").
const copia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))); // como se passasse pela rede
let contador = 0;

export class FakeIO {
  constructor() {
    this.ouvintes = [];
    this.sockets = new Map();
    this.salas = new Map();
  }

  on(evt, fn) {
    if (evt === "connection") this.ouvintes.push(fn);
  }

  /** io.to(<id do socket ou nome da sala>).emit(...) */
  to(alvo) {
    return {
      emit: (evt, data) => {
        const ids = this.sockets.has(alvo) ? [alvo] : [...(this.salas.get(alvo) || [])];
        for (const id of ids) this.sockets.get(id)?.cliente.receber(evt, data);
      },
    };
  }

  /** Abre uma conexão e devolve o "navegador": send(evento, dados), events(nome), clear(). */
  connect(ip = "1.1.1.1") {
    const io = this;
    const id = `sock${++contador}`;
    const recebidos = [];
    const handlers = {};
    const cliente = {
      id,
      send: (evt, data) => handlers[evt]?.(copia(data)),
      events: (nome) => recebidos.filter(([e]) => e === nome).map(([, d]) => d),
      clear: () => { recebidos.length = 0; },
      receber: (evt, data) => recebidos.push([evt, copia(data)]),
      disconnect() {
        handlers.disconnect?.();
        for (const sala of io.salas.values()) sala.delete(id);
        io.sockets.delete(id);
      },
    };
    const socket = {
      id,
      cliente,
      handshake: { address: ip, headers: {} },
      on: (evt, fn) => { handlers[evt] = fn; },
      emit: (evt, data) => cliente.receber(evt, data),
      join(sala) {
        if (!io.salas.has(sala)) io.salas.set(sala, new Set());
        io.salas.get(sala).add(id);
      },
      to: (sala) => ({
        emit(evt, data) {
          for (const sid of io.salas.get(sala) || []) if (sid !== id) io.sockets.get(sid).cliente.receber(evt, data);
        },
      }),
    };
    this.sockets.set(id, socket);
    this.ouvintes.forEach((f) => f(socket));
    return cliente;
  }
}
