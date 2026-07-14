# CLUTCHZONE

Plataforma de campeonatos de eSports com frontend estático e backend seguro para autenticação Steam.

## Arquitetura

- `*.html`, `*.css`, `*.js`: frontend legado que pode ser publicado no GitHub Pages.
- `clutchzone-app/`: evolução Vite + TypeScript do frontend.
- `backend/`: monólito modular Express + TypeScript, PostgreSQL e Prisma.
- `backend/prisma/`: modelo e migration real de usuários, sessões, rate limits e estado compatível.

O navegador nunca recebe a chave da Steam, não processa o retorno OpenID e não armazena autenticação no `localStorage`. A sessão é identificada por cookie `HttpOnly` e persistida no PostgreSQL. Papéis e status vêm exclusivamente do usuário armazenado no backend.

## Endpoints

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/auth/steam` | Inicia Steam OpenID; aceita apenas `returnTo` local |
| `GET` | `/auth/steam/callback` | Valida a asserção Steam, sincroniza o perfil e cria a sessão |
| `GET` | `/auth/me` | Retorna o usuário da sessão |
| `POST` | `/auth/logout` | Destrói a sessão e expira o cookie |
| `GET` | `/api/global/catalog` | Catálogo público de idiomas/formatação, moedas, regiões globais e datacenters operacionais |
| `GET/PUT` | `/api/global/preferences` | Lê ou salva idioma, fuso, moeda e região usando somente a identidade da sessão |
| `GET` | `/api/friends/steam` | Sincroniza a lista pública de amigos Steam da conta autenticada |
| `GET` | `/api/tournaments/:tournamentId/players/:playerName/cs2-inventory` | Exibe o inventário público de CS2 de um jogador confirmado no campeonato |
| `GET` | `/api/players/:userId/showcases/:game/inventory` | Exibe a vitrine pública permanente do perfil para `cs2` ou `pubg`; o backend resolve o SteamID pelo usuário Clutchzone |
| `GET` | `/api/teams/mine` | Lista somente as equipes da sessão autenticada |
| `GET/POST` | `/api/teams/:teamId/messages` | Lê ou envia mensagens no canal privado; exige participação no roster |
| `GET` | `/api/marketplace/listings` | Vitrine pública de anúncios publicados |
| `POST` | `/api/marketplace/listings/:listingId/orders` | Cria pedido ou proposta com a identidade da sessão |
| `GET/PUT/POST/PATCH` | `/api/seller/*` | Perfil comercial, anúncios, estoque e pedidos do ERP do vendedor |
| `GET` | `/api/store/:key` | Compatibilidade de leitura para dados existentes |
| `POST` | `/api/store/:key` | Compatibilidade de escrita; exige sessão |

## Variáveis de ambiente do backend

Copie `backend/.env.example` para `backend/.env` e preencha todos os valores. A inicialização falha se uma variável obrigatória estiver ausente ou inválida.

| Variável | Descrição |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `PORT` | Porta HTTP do backend |
| `DATABASE_URL` | URL PostgreSQL |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |
| `STEAM_API_KEY` | Chave Steam Web API, somente no backend; necessária no callback para sincronizar o perfil, mas não para iniciar o redirecionamento OpenID |
| `FRONTEND_URL` | URL canônica do frontend |
| `BACKEND_URL` | URL pública do backend; HTTPS obrigatório em produção |
| `CORS_ORIGINS` | Lista exata de origens permitidas, separada por vírgulas |
| `TRUST_PROXY` | `true` atrás do proxy de Render/Railway/Fly |

Gere um segredo de sessão com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No frontend legado, defina a URL pública em `config.js`. No Vite, use `VITE_BACKEND_URL`.

## Executar localmente

Pré-requisitos: Node.js 20.19+, Docker e Docker Compose.

```bash
docker compose up -d postgres
cd backend
copy .env.example .env
npm install
npm run doctor
npm run migrate:deploy
npm run dev
```

Em outro terminal:

```bash
cd C:\Users\rique\OneDrive\Documentos\TESTESITE
npm run dev
```

Abra `http://localhost:3000`. O backend usa `http://localhost:3001` por padrão no frontend local.
O login começa em `http://localhost:3001/auth/steam` e o callback OpenID de desenvolvimento é `http://localhost:3001/auth/steam/callback`.

`http://localhost:3000` é a única origem canônica do frontend em desenvolvimento. Acessos por `127.0.0.1`, pela pasta `clutchzone-app/` ou pelo servidor Vite são redirecionados para essa origem para impedir alternância de versão e perda do cookie `SameSite`. Todas as páginas carregam a mesma configuração pública, o mesmo cliente de autenticação e os mesmos componentes compartilhados. Uma falha transitória não encerra a sessão: a interface tenta sincronizá-la novamente em segundo plano e o logout só ocorre por ação explícita do usuário.

A vitrine comercial está em `http://localhost:3000/marketplace.html` e o ERP em `http://localhost:3000/seller-erp.html`. O ERP administra propostas, pedidos, publicação e estoque; pagamentos e repasses financeiros ainda não são processados pela plataforma.

O seletor **Global** aparece em todas as páginas. Há 13 opções de idioma/formatação, fusos IANA, 13 moedas e cobertura de comunidade para América do Sul, América do Norte, Europa, Oriente Médio, África, Ásia e Oceania. Usuários Steam autenticados sincronizam essas preferências no PostgreSQL; visitantes recebem apenas uma configuração temporária derivada do navegador, sem identidade em `localStorage`. A região global do usuário não é confundida com capacidade de servidor: o catálogo informa separadamente os seis datacenters atualmente medidos pelo sistema de partidas.

Valores do marketplace agora carregam a moeda real definida pelo vendedor em anúncios, pedidos e relatórios. A preferência visual de moeda nunca renomeia um valor BRL como se fosse USD, nem realiza conversão cambial implícita.

## Qualidade

```bash
cd backend
npm test
npm run lint
npm run typecheck
npm run build
npm audit

cd ../clutchzone-app
npm run type-check
npm run build
```

Os testes cobrem login/callback, SteamID inválido, usuário idempotente, conflito de SteamID, sessão, logout, CORS, rate limiting, rota protegida, open redirect e erros seguros. As chamadas externas da Steam são simuladas.

A lista social combina amizades internas do Clutchzone com amigos retornados pela Steam. A identidade consultada sempre vem da sessão do backend. Perfis com lista de amigos privada não podem ser sincronizados; nesse caso a interface preserva normalmente as amizades internas.

As vitrines de inventário ficam disponíveis no passaporte do jogador mesmo fora de campeonatos. O backend aceita apenas o ID interno do usuário Clutchzone e um jogo permitido (`cs2` ou `pubg`), resolve o SteamID cadastrado e sincroniza automaticamente os melhores destaques públicos por tipo e raridade. A coleção completa reutiliza o mesmo resultado em cache ao ser aberta. A rota antiga de campeonato continua exigindo participação aprovada. Inventários privados e indisponibilidade da Steam possuem estados visuais próprios e não bloqueiam o restante do perfil. A consulta de inventário público não envia `STEAM_API_KEY` ao navegador.

O plano de produto e segurança para salas dedicadas, veto de mapas e séries MD1/MD3 está em [`docs/CS2_MATCH_AUTOMATION.md`](docs/CS2_MATCH_AUTOMATION.md).

O canal **Equipe** do chat usa equipes, membros e mensagens persistidos no PostgreSQL. O `teamId` e o remetente não são aceitos como identidade do navegador: cada leitura e envio valida `req.session.userId` contra o roster no backend. Atalhos ocultados pelo próprio usuário continuam sendo apenas uma preferência visual local.

## Deploy

### Render

1. Use o `render.yaml` como Blueprint.
2. Configure `STEAM_API_KEY`, `FRONTEND_URL` e `CORS_ORIGINS` no painel.
3. Confirme `BACKEND_URL` com a URL HTTPS definitiva do serviço.
4. O comando de início aplica `prisma migrate deploy` antes de iniciar o servidor.
5. Publique o frontend no GitHub Pages e atualize `config.js` com a URL do backend.

Railway e Fly.io podem usar `backend/Dockerfile`; configure as mesmas variáveis e execute a migration antes de cada release.

Para cookies entre GitHub Pages e outro domínio, o backend usa `SameSite=None; Secure`. Alguns navegadores bloqueiam cookies de terceiros; para máxima compatibilidade, use frontend e API em subdomínios do mesmo domínio registrável.

## Segurança e limitações

Consulte `SECURITY.md`. O fluxo de autenticação está pronto para múltiplas instâncias. Equipes novas, chat privado de equipe e marketplace já usam modelos transacionais e autorização por recurso. Partes legadas de campeonatos, convites antigos, chat geral e pagamentos ainda usam documentos agregados ou não estão implementadas; a rota de compatibilidade preserva dados existentes, mas esses fluxos devem ser migrados antes de uso financeiro ou competitivo em produção.
