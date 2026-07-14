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

Consulte `SECURITY.md`. O fluxo de autenticação está pronto para múltiplas instâncias. Os domínios antigos de equipes, campeonatos, chats e pagamentos ainda usam documentos agregados e lógica de autorização no cliente; a rota de compatibilidade preserva o comportamento, mas novas operações sensíveis devem migrar para modelos e rotas transacionais com autorização por recurso antes de uso financeiro ou competitivo em produção.
