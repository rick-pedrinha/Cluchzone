# Automação de partidas privadas CS2

## Decisão técnica

O Clutchzone não deve tentar gerar códigos do matchmaking privado oficial do CS2. As APIs de lobby da Steamworks são destinadas ao publicador do aplicativo e as operações de servidor exigem credenciais próprias do publicador. Uma Steam Web API Key comum do Clutchzone não concede controle sobre o AppID 730.

O caminho controlável para o produto é provisionar servidores dedicados CS2 e emitir, dentro do Clutchzone, uma credencial temporária de acesso para cada partida. O jogador recebe `endereço:porta` e senha, nunca GSLT, RCON ou credenciais do provedor.

Referências:

- Steamworks Game Servers: https://partner.steamgames.com/doc/features/multiplayer/game_servers
- Gestão oficial de GSLT: https://steamcommunity.com/dev/managegameservers
- MatchZy: https://github.com/shobhit-pathak/MatchZy
- Configuração de partidas MatchZy: https://shobhit-pathak.github.io/MatchZy/match_setup/
- API de servidores DatHost: https://dathost.net/reference/game-servers-general
- Estado atual do controle RCON no CS2: https://help.dathost.net/article/137-cs2-rcon

## Arquitetura recomendada

1. O backend Clutchzone cria a partida e persiste formato, equipes, escalações SteamID64, pool de mapas e horário.
2. O `Match Orchestrator` provisiona uma instância por meio de um adaptador de provedor. O primeiro adaptador pode apontar para um host próprio; provedores gerenciados entram depois sem alterar o domínio da aplicação.
3. A instância inicia CS2 Dedicated Server com SteamCMD, um GSLT exclusivo e senha de servidor gerados no backend.
4. MatchZy recebe por URL uma configuração JSON contendo SteamID64 dos jogadores, `num_maps`, mapas escolhidos, lados e regras.
5. Apenas jogadores confirmados recebem a credencial temporária de conexão. Segredos operacionais permanecem criptografados no backend.
6. Eventos do servidor atualizam placar, mapa, pausas, resultado e demo. Ao fim da série, a instância é liberada.

```text
check-in das equipes
        ↓
veto/sorteio de mapas
        ↓
fila de provisionamento
        ↓
servidor CS2 + MatchZy
        ↓
credencial de conexão para o roster
        ↓
eventos, placar, demo e encerramento
```

## Fluxo de veto

O capitão autenticado só pode agir pela própria equipe e pela partida em que está escalado. Todas as ações devem usar `req.session.userId`, ser transacionais e possuir prazo.

- MD1 com sete mapas: A bane, B bane, A bane, B bane, A bane, B bane; o mapa restante é jogado.
- MD3 com sete mapas: A bane, B bane, A escolhe, B escolhe, A bane, B bane; o restante é o desempate.
- O primeiro time pode ser definido por sorteio criptograficamente seguro ou por seed configurada antes do veto.
- Se o relógio expirar, o backend escolhe automaticamente entre os mapas ainda válidos e registra a decisão no histórico.
- O lado inicial pode ser escolhido pelo adversário no mapa selecionado ou decidido por knife round.

As regras devem ser configuráveis por campeonato, sem aceitar do navegador uma sequência de veto já calculada.

## MD1 e MD3

O formato pertence à partida no backend:

- `BEST_OF_1`: `num_maps = 1`; a série termina após um mapa.
- `BEST_OF_3`: `num_maps = 3`; com `clinch_series = true`, termina quando uma equipe alcança duas vitórias.

MatchZy já suporta BO1/BO3/BO5, veto, escalação travada por SteamID64, ready system, demos e restauração de rounds. O Clutchzone deve ser a fonte de verdade para autorização, agenda e resultado oficial; o plugin executa as regras dentro do servidor.

## Estados mínimos

```text
SCHEDULED → CHECK_IN → VETO → PROVISIONING → READY
READY → LIVE → COMPLETED → RELEASING → RELEASED
qualquer estado operacional → FAILED → RETRYING ou CANCELLED
```

Cada transição precisa de auditoria, idempotência e controle de concorrência. Um clique repetido em “criar sala” não pode provisionar dois servidores.

## Rotas propostas

- `POST /api/matches/:matchId/check-in`
- `POST /api/matches/:matchId/veto/actions`
- `POST /api/matches/:matchId/provision` — organizador ou capitão autorizado, conforme regra do campeonato
- `GET /api/matches/:matchId/room` — retorna conexão somente para roster, organizador e admin
- `POST /api/internal/match-events` — webhook assinado vindo do servidor
- `POST /api/matches/:matchId/retry` — operação idempotente de recuperação

## Segredos e operação

- `GSLT`, senha do servidor, credencial do canal de controle e token do provedor nunca vão para o frontend ou logs.
- Use um GSLT por instância ou por slot fixo; a Valve permite até 1000 contas de servidor por conta elegível e responsabiliza o proprietário pelos tokens.
- Não dependa apenas do RCON nativo dentro do jogo. O adaptador deve usar o canal de console oferecido pelo provedor ou uma ferramenta externa compatível, sempre restrita à rede do orquestrador.
- A senha entregue aos jogadores deve expirar ao final da série.
- Webhooks precisam de assinatura, timestamp e proteção contra replay.
- Demos e logs devem ser armazenados fora da instância antes de destruí-la.

## Sequência de entrega

1. Escolher onde os servidores rodarão e confirmar que o provedor oferece API de criar, iniciar, parar, destruir e enviar comandos ao console. Para o MVP, um provedor gerenciado com REST API reduz muito o tempo de operação; em escala, o mesmo adaptador pode ser trocado por um pool próprio.
2. Criar migrations aditivas para partidas, veto, alocação de servidor, eventos e auditoria.
3. Implementar o adaptador do provedor e uma fila de jobs com retries e idempotência.
4. Implementar check-in, veto MD1/MD3 e autorização de capitães.
5. Instalar e validar CS2 Dedicated Server, GSLT, CounterStrikeSharp e MatchZy em uma imagem imutável.
6. Conectar eventos, demos, placar e encerramento automático.
7. Fazer um piloto controlado antes de permitir provisionamento automático em todos os campeonatos.

O bloqueio para começar a implementação não é de software: é escolher o provedor/host e disponibilizar os GSLTs de teste. Nenhuma dessas credenciais deve ser commitada no repositório.
