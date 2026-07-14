# Arquitetura evolutiva da ClutchZone

## Decisão

A ClutchZone seguirá uma migração incremental por contextos de domínio. O backend atual permanece executável como um monólito modular enquanto cada módulo ganha banco lógico, contratos de evento e fronteiras próprias. Um contexto só vira processo ou deploy independente quando houver necessidade operacional, de escala ou de equipe.

Essa abordagem preserva autenticação Steam, sessões e rotas existentes e evita criar vários serviços vazios com chamadas distribuídas frágeis.

## Fonte de verdade

- O navegador nunca é fonte de identidade, papel, pagamento, status, roster ou resultado.
- A identidade das mutações vem exclusivamente de `req.session.userId`.
- A sessão HTTP com cookie seguro continua sendo a autenticação do navegador. JWT e refresh token ficam reservados para clientes de API explicitamente autorizados e identidade serviço-a-serviço; não haverá um segundo login paralelo no frontend.
- SteamID64 é obtido e validado pelo OpenID no backend. `STEAM_API_KEY`, GSLT, RCON, tokens de provedor e senhas nunca chegam ao navegador.

## Contextos e propriedade de dados

| Contexto | Responsabilidade | Próxima fronteira de persistência |
| --- | --- | --- |
| Authentication | Steam OpenID, usuários, sessão, papéis e status | Authentication Database |
| Tournament | campeonato, inscrição, regras e calendário | Tournament Database |
| Team | equipe, roster, capitão e convites | Team Database |
| Match | check-in, veto, formato, região, estado e resultado | Match Database |
| Game Server Orchestrator | provisionar, observar e destruir instâncias efêmeras | metadados no Match Database; segredos em cofre |
| Payments / Subscription / Wallet | cobrança, plano, ledger imutável e conciliação | Payments Database, isolado dos demais |
| Notification / Chat | entrega assíncrona e presença | Redis e armazenamento próprio |
| Statistics / Replay | eventos de jogo, placar, demo e retenção | Statistics e Replay Databases + object storage |
| Admin / Audit | operações privilegiadas e trilha append-only | Logs/Audit Database |

## Fundação implementada

O primeiro corte cria no PostgreSQL:

- partidas com MD1/MD3 e máquina de estados;
- roster ligado a IDs internos de usuários ativos;
- check-in obtido somente da sessão do jogador;
- medições de latência para São Paulo, Virginia, Frankfurt, Londres, Singapura e Sydney;
- seleção equilibrada que minimiza primeiro o pior ping e depois a média;
- alocação efêmera de servidor sem armazenar credenciais em claro;
- outbox transacional com chave de idempotência;
- auditoria append-only das operações de partida.

O evento `match.provisioning.requested` é gravado na mesma transação da mudança para `PROVISIONING`. O worker de outbox usa leasing concorrente, publica mensagens persistentes em um exchange `topic` do RabbitMQ, confirma a gravação pelo broker e só então marca o evento como publicado. A fila quorum de Match é criada e ligada a `match.#`. A entrega é *at least once*, portanto todo consumidor deve ser idempotente.

## Fluxo de partida

```text
SCHEDULED -> CHECK_IN -> VETO -> PROVISIONING -> READY -> LIVE
LIVE -> COMPLETED -> RELEASING -> RELEASED
estado operacional -> FAILED -> RETRYING ou CANCELLED
```

1. Organizador ou admin cria a partida com dois times e usuários ativos.
2. Cada participante mede as regiões e confirma presença com sua sessão.
3. O backend abre o estado de veto quando todos confirmam.
4. Um pedido de provisionamento exige `Idempotency-Key`, escolhe a região e gera o evento de outbox.
5. O futuro worker do Game Server Orchestrator cria a instância, configura CS2/MatchZy/GOTV e guarda apenas uma referência ao segredo.
6. Eventos assinados atualizam a partida, enviam demos ao object storage e solicitam a destruição da instância.

Não existe servidor de jogo permanente nesse desenho.

## Escala e múltiplas regiões

- API stateless atrás de Load Balancer; sessões saem do PostgreSQL para Redis altamente disponível quando houver implantação distribuída.
- Kubernetes Deployment com rolling update, readiness, liveness, PodDisruptionBudget e HPA.
- HPA da API atende tráfego HTTP; servidores de jogo são escalados pela profundidade da fila e capacidade regional, não por CPU da API.
- Cada região terá probes assinados de latência, workers do orquestrador e pools independentes de capacidade.
- O banco começa primário em uma região com réplicas de leitura e backups testados. Escrita multi-primary só deve entrar quando os domínios e requisitos de consistência justificarem.

## Ordem segura de extração

1. Migrar Tournament e Team do estado genérico/frontend para APIs backend autorizadas.
2. Implantar o RabbitMQ e adicionar consumers idempotentes do Game Server Orchestrator.
3. Implementar veto transacional e webhook interno assinado.
4. Escolher provedor de game server, cofre de segredos e GSLTs de teste.
5. Extrair Match + Game Server Orchestrator como primeiros deploys independentes.
6. Extrair Payments/Wallet antes de aceitar dinheiro real.
7. Adicionar OpenTelemetry, métricas de negócio, logs centralizados e SLOs por contexto.

## Pendências que exigem decisão externa

- Provedor/hosts de CS2 e API de ciclo de vida.
- GSLTs de teste e política de rotação.
- Broker gerenciado, Redis gerenciado, object storage e cofre de segredos.
- Regiões efetivamente contratadas e endpoints de probe.
- Política legal de retenção de IP, hardware ID, demos e dados antifraude.

Nenhuma dessas credenciais deve ser colocada no repositório.
