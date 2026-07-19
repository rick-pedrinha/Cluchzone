# CLUTCHZONE

Plataforma de campeonatos de eSports com frontend estático e backend seguro para autenticação Steam.

## Arquitetura

Este repositório contém **apenas o frontend**. O backend (monólito modular Express + TypeScript, PostgreSQL e Prisma) vive no repositório separado [`clutchzone-backend`](https://github.com/rick-pedrinha/clutchzone-backend) e é consumido via CORS/sessão cross-site.

- `*.html`, `*.css`, `*.js`: frontend legado que pode ser publicado no GitHub Pages.
- `clutchzone-app/`: evolução Vite + TypeScript do frontend.

O navegador nunca recebe a chave da Steam, não processa o retorno OpenID e não armazena autenticação no `localStorage`. A sessão é identificada por cookie `HttpOnly` e persistida no PostgreSQL pelo backend. Papéis e status vêm exclusivamente do usuário armazenado lá.

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

## Configurar a URL do backend

No frontend legado, defina a URL pública em `config.js` (`window.CLUCHZONE_BACKEND_URL`). No Vite (`clutchzone-app/`), copie `.env.example` para `.env` e defina `VITE_BACKEND_URL`. Em ambos, `localhost`/`127.0.0.1` caem automaticamente em `http://localhost:3001` quando a variável não está definida.

As variáveis de ambiente do backend em si (`SESSION_SECRET`, `STEAM_API_KEY`, `CORS_ORIGINS` etc.) são documentadas no README do repositório [`clutchzone-backend`](https://github.com/rick-pedrinha/clutchzone-backend).

## Executar localmente

Pré-requisitos: Node.js 20.19+, Docker e Docker Compose (para o backend).

Em um terminal, suba o backend a partir do repositório separado:

```bash
cd ../clutchzone-backend
cp .env.example .env
npm install
npm run dev
```

`npm run dev` regenera o Prisma Client, inicia PostgreSQL e RabbitMQ pelo Docker Compose,
aguarda o healthcheck e aplica migrations pendentes antes de abrir o backend em `:3001`.

Em outro terminal, a partir da raiz deste repositório:

```bash
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
cd clutchzone-app
npm run type-check
npm run build
```

Os testes de backend (login/callback, SteamID inválido, usuário idempotente, conflito de SteamID, sessão, logout, CORS, rate limiting, rota protegida, open redirect e erros seguros) vivem no repositório `clutchzone-backend`.

A lista social combina amizades internas do Clutchzone com amigos retornados pela Steam. A identidade consultada sempre vem da sessão do backend. Perfis com lista de amigos privada não podem ser sincronizados; nesse caso a interface preserva normalmente as amizades internas.

As vitrines de inventário ficam disponíveis no passaporte do jogador mesmo fora de campeonatos. O backend aceita apenas o ID interno do usuário Clutchzone e um jogo permitido (`cs2` ou `pubg`), resolve o SteamID cadastrado e sincroniza automaticamente os melhores destaques públicos por tipo e raridade. A coleção completa reutiliza o mesmo resultado em cache ao ser aberta. A rota antiga de campeonato continua exigindo participação aprovada. Inventários privados e indisponibilidade da Steam possuem estados visuais próprios e não bloqueiam o restante do perfil. A consulta de inventário público não envia `STEAM_API_KEY` ao navegador.

O plano de produto e segurança para salas dedicadas, veto de mapas e séries MD1/MD3 está em [`docs/CS2_MATCH_AUTOMATION.md`](docs/CS2_MATCH_AUTOMATION.md).

O canal **Equipe** do chat usa equipes, membros e mensagens persistidos no PostgreSQL. O `teamId` e o remetente não são aceitos como identidade do navegador: cada leitura e envio valida `req.session.userId` contra o roster no backend. Atalhos ocultados pelo próprio usuário continuam sendo apenas uma preferência visual local.

## Deploy

### Backend

O deploy do backend (Render, Railway, Fly.io) é inteiramente gerenciado pelo repositório [`clutchzone-backend`](https://github.com/rick-pedrinha/clutchzone-backend) — este repo não tem `render.yaml` nem qualquer config de deploy de backend.

### Frontend

O frontend estático é publicado no GitHub Pages via `.github/workflows/deploy.yml` a cada push em `main`. Antes de publicar, confirme que `config.js` aponta para a URL HTTPS correta do backend em produção.

Para cookies entre GitHub Pages e outro domínio, o backend usa `SameSite=None; Secure`. Alguns navegadores bloqueiam cookies de terceiros; para máxima compatibilidade, use frontend e API em subdomínios do mesmo domínio registrável.

## Segurança e limitações

Consulte `SECURITY.md`. O fluxo de autenticação está pronto para múltiplas instâncias. Equipes novas, chat privado de equipe e marketplace já usam modelos transacionais e autorização por recurso. Partes legadas de campeonatos, convites antigos, chat geral e pagamentos ainda usam documentos agregados ou não estão implementadas; a rota de compatibilidade preserva dados existentes, mas esses fluxos devem ser migrados antes de uso financeiro ou competitivo em produção.

## Demo

Acesse a demonstração completa, com login Steam e dados persistentes, [aqui](https://rick-pedrinha.github.io/Cluchzone/).
