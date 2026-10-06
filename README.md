# Mesa de RPG (Node + Socket.IO + Vite/React + Docker)

## Rodar com Docker (recomendado)
```bash
docker compose up -d --build
```
Abra http://localhost:8080/?sala=taverna (use `PORT=9000 docker compose up -d` para trocar a porta).
Para jogar em rede, use o IP da máquina: `http://IP:8080`.

Tudo (salas, tokens, névoa e mapas enviados) fica no volume `mesa-data`.
- Backup: `docker run --rm -v mesa-rpg_mesa-data:/data -v "$PWD":/b alpine tar czf /b/backup.tgz /data`
- Parar sem perder dados: `docker compose down` (só `down -v` apaga o volume)

## Rodar sem Docker (desenvolvimento)
```bash
npm run install:all
npm run server   # http://localhost:3001  (dados em server/data)
npm run client   # http://localhost:5173
```

## Estrutura do código
```
server/                        Node.js (ESM) + Socket.IO
  index.js                     sobe HTTP + Socket.IO e chama registerHandlers
  src/
    app.js                     registra cada grupo de eventos (recebe o io, então dá para testar com um io falso)
    config.js                  limites e variáveis de ambiente
    lib/util.js                helpers (clamp, dados, merge seguro)
    domain/                    regras do jogo, sem rede nem disco
      rules.js                 sistemas (D&D 5e / Pathfinder 2e), fichas, resistências e CD de magia
      dice.js                  expressões de dano com várias parcelas (2d6+1d4+3)
      areas.js                 geometria das áreas de magia (IDÊNTICO ao do cliente)
      conditions.js            validação dos emojis de condição e duração
      permissions.js           quem é mestre / quem controla o token
    services/                  regras aplicadas às salas, falando com os sockets
      combat.js                graus de sucesso, dano, cura, morte e duração das condições
      initiative.js            estado da iniciativa e visão de cada jogador
      vision.js                paredes, linha de visão, exploração, envio filtrado
    infra/                     disco e HTTP
      storage.js               salas em memória + JSON em disco
      uploads.js               upload/entrega de mapas e limpeza de órfãos
      password.js              hash scrypt e limite de tentativas
    handlers/                  um arquivo por grupo de eventos: session, tokens, sheets, walls, fog, grid, initiative, combat, chat
  test/                        fake-io.js (Socket.IO falso) e combate.test.mjs  ->  npm test

client/                        Vite + React
  index.html, vite.config.js
  src/
    main.jsx, App.jsx          raiz: alterna entre Entrada e Mesa e mantém a conexão
    engine/                    o núcleo, sem React (canvas, rede, regras de exibição)
      state.js                 estado, helpers e barramento de eventos (on/notify)
      net.js                   Socket.IO: eventos do servidor -> estado
      render.js, input.js      desenho do canvas e mouse/toque (ligados a um <canvas> por attachCanvas/attachInput)
      geometry.js, areas.js    paredes e luz (espelham o servidor); áreas de magia
      mira.js                  escolher alvo do ataque e posicionar a área da magia
      ficha.js                 qual ficha está aberta + edição otimista
      tools.js, iniciativa.js  ferramenta da barra do mestre; helpers da iniciativa
      log.js, rules.js         registro de chat/dados/combate; valores derivados da ficha
      conditions.js            paleta de condições
    hooks/useEngine.js         re-renderiza o componente quando eventos do engine disparam
    components/                Entrada, Mesa, Mapa (canvas + barra do mestre + avisos), Campo (inputs que confirmam ao sair)
      painel/                  Painel, AbaToken (TokenSelecionado, NovoToken), AbaIniciativa, AbaMestre, ChatDock
      ficha/                   Ficha (janela arrastável), Campos, SecoesSistema (D&D / PF2e), ListasCombate
    styles/style.css
scripts/check-shared.mjs       confere que o areas.js do servidor e do cliente são idênticos
```

**Como o React conversa com o engine:** o estado do jogo (`state`) continua um objeto mutável fora do React, e o servidor o atualiza
via `net.js`. Cada componente chama `useEngine("evento", ...)` e lê `state` ao renderizar; o canvas se redesenha sozinho pelo
evento `draw` (por isso nenhum componente assina `draw`). Para adicionar um painel novo: crie o componente, assine os eventos de
que ele precisa e use `send(...)` para falar com o servidor.

**Testes e checagens:** `npm test` (servidor, com Socket.IO falso, sem rede) e `npm run check` (arquivos duplicados). `npm run verify` roda os dois.

## Como funciona
- **Barra do mestre (sobre o mapa):** Mover, Parede, Porta, Sala, Apagar, Revelar, Esconder, além de **Tirar névoa / Pôr névoa** e **Cobrir tudo**.
  Tirar névoa só desliga: o que foi revelado e explorado fica guardado e volta ao religar. Cobrir tudo esconde o mapa inteiro de novo.
  Aparece só para o mestre: confira se há "(mestre)" ao lado do seu nome na lista de jogadores. A identidade fica salva no navegador,
  então abrir a sala em outro navegador (ou depois de limpar os dados) entra como jogador comum.
- **Dono do token:** o mestre escolhe o dono ao criar o token e pode trocar na aba Token ("Dono do token") com o token selecionado.
  "Mestre (NPC)" deixa o token só com ele.
- **Iniciativa:** aba própria. Adicione tokens (botão "+ Iniciativa" do token selecionado, "+ Meus tokens" ou "+ Todos" para o mestre),
  role 1d20 + modificador da ficha (D&D: DES; Pathfinder 2e: Percepção) ou digite o valor. A lista ordena sozinha.
  O mestre inicia o combate e controla os turnos; o dono de quem está no turno também pode passar a vez.
  O token da vez ganha um anel dourado e uma faixa "Rodada / Turno" aparece sobre o mapa.
  Inimigos escondidos pela névoa não aparecem na lista dos jogadores, e rolagens de NPC só o mestre vê.
- **Condições:** com o token selecionado, clique nos emojis (atordoado, envenenado, em guarda...) ou digite qualquer outro emoji.
  Até 8 por token, visíveis acima dele no mapa e na iniciativa. O dono e o mestre editam.
  **Duração:** informe as rodadas antes de adicionar (vazio = sem fim). A cada nova rodada da iniciativa todas as durações diminuem 1;
  ao zerar, a condição sai e o log avisa. Voltar um turno não devolve duração. O 💀 aparece sozinho em 0 PV e some ao curar.
- **Combate (ataque e dano):** na ficha, cadastre ataques (bônus, dano como `1d8+3` ou `2d6+1d4+2`, tipo). Pelo botão "⚔ Atacar" (ficha ou aba Token)
  escolha o alvo no mapa: o servidor rola o d20 (D&D: vantagem/desvantagem; PF2e: 2º/3º ataque com -5/-10), compara com a CA e, se acertar, rola o dano
  e aplica no alvo (PV temporário primeiro). Crítico: D&D dobra os dados; PF2e dobra o total e os graus de sucesso seguem a regra de ±10. 
  20 e 1 naturais: D&D acerta/erra sempre; PF2e sobe/desce um grau. Também há rolagem só do ataque, só do dano e do dano crítico.
  Jogador só vê "acerto/erro" (a CA e os PV alheios ficam para o mestre) e só ataca o que enxerga.
- **Magias em área:** cadastre magias na ficha (esfera, cubo, cone, linha ou emanação; tamanho em pés; dano ou cura; teste de resistência; CD ou padrão da ficha;
  condição com duração). "✨ Conjurar" mostra a área acompanhando o cursor, com anel nos atingidos. Esfera e cubo ficam onde você clica (encaixam nos cantos da grade);
  cone, linha e emanação saem do conjurador. O cone segue o sistema (D&D: largura = comprimento; PF2e: 90°). Paredes e portas fechadas bloqueiam o efeito.
  O servidor rola o dano uma vez e a resistência de cada alvo (D&D: metade ou nada; PF2e: resistência básica com os 4 graus).
  O mestre pode desligar a aplicação automática na aba Mestre (aí tudo aparece no log e você aplica à mão).
- **Sistema de jogo:** escolhido por quem cria a sala (D&D 5e ou Pathfinder 2e) e fixo depois.
- **Ficha do token:** dois cliques (ou dois toques) no token, ou botão "Abrir ficha". Janela flutuante, arrastável.
  - Comum: nome, nível, tendência, 6 atributos, PV máx./atual/temporário, CA base, deslocamento, notas.
  - D&D 5e: bônus de proficiência, 6 resistências, iniciativa, percepção passiva, dados de vida, inspiração, testes de morte.
  - Pathfinder 2e: postos TEML + nível, Fortitude/Reflexos/Vontade, Percepção como iniciativa, Class DC, pontos de herói e de foco.
  - Só o dono e o mestre recebem a ficha; a barra de PV no mapa aparece só para eles.
- **Arrastar tokens:** arraste a peça do painel "Novo token" até o mapa, ou qualquer token já posto; encaixa na grade ao soltar.
- **Paredes e portas:** as linhas encaixam nos cantos da grade. Parede e porta fechada bloqueiam a visão (linha de visão real);
  com a ferramenta Mover, clique numa porta para abrir ou fechar. Paredes não impedem o movimento.
- **Senha da sala:** quem cria a sala vira o mestre e a senha a protege (vazio = sala aberta). Hash scrypt e bloqueio de 60 s após 5 erros por IP/sala.
- **Névoa compartilhada:** tokens com visão (jogador 6, NPC 0) iluminam o entorno respeitando paredes; o já iluminado fica explorado (esmaecido).
  O servidor só envia ao jogador os tokens que ele pode ver.
- **Mapa:** upload de PNG/JPG/WEBP/GIF (até 10 MB) ou URL. A imagem começa na origem (0,0); ajuste "Casa" e "Escala".
- **Limpeza de uploads:** a cada 6 h (e ao iniciar) apaga imagens que nenhuma sala usa e que têm mais de 60 min.
- **Dados:** botões ou `/r 2d6+3`, rolados no servidor.
- Mouse: arrastar vazio move a câmera, scroll dá zoom, Delete remove o token selecionado, Esc fecha a ficha.

## Limitações
- Os atributos são pontuações (1 a 30) nos dois sistemas e o modificador é calculado.
- O bônus de ataque e o dano são digitados na ficha (não são derivados de arma/atributo). Resistências e imunidades a tipos de dano não são aplicadas.
- Alcance e distância máxima das ações não são verificados; as magias em área não têm concentração, espaços ou níveis de magia.
- A geometria das paredes é enviada a todos os clientes. O servidor filtra de verdade só tokens, fichas e iniciativa.
- Não há contas de usuário: quem apagar os dados do navegador perde a identidade (o mestre pode reatribuir os tokens).
- A imagem do mapa é pública para quem tiver o link; a névoa esconde só visualmente a imagem.
- Em produção na internet, coloque HTTPS na frente (proxy reverso ou Cloudflare Tunnel), senão a senha trafega em texto puro.
