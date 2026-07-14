# Instruções para agentes

- Use Node.js 20.19 ou superior.
- Autenticação, Steam API, sessão, papéis e status pertencem exclusivamente ao backend.
- Nunca adicione login simulado, senha Steam, identidade em `localStorage` ou fallback por cabeçalho/nickname.
- Toda mutação sensível deve obter a identidade de `req.session.userId` e validar autorização no backend.
- Não adicione defaults para `SESSION_SECRET`, `STEAM_API_KEY` ou `DATABASE_URL`.
- Após mudanças no backend, execute `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e `npm audit` em `backend/`.
- Após mudanças no Vite, execute `npm run type-check` e `npm run build` em `clutchzone-app/`.
- Migrations são aditivas; não altere uma migration já aplicada em produção.
- Preserve dados e mudanças do usuário; não execute reset destrutivo do Git ou banco.
