# Instruções para agentes

- Use Node.js 20.19 ou superior.
- Este repositório **não contém código de backend**. O backend vive no repositório separado `clutchzone-backend` (diretório irmão `../clutchzone-backend`); mudanças em autenticação, Steam API, sessão, papéis e status acontecem lá, nunca aqui.
- Nunca adicione login simulado, senha Steam, identidade em `localStorage` ou fallback por cabeçalho/nickname.
- Toda mutação sensível deve obter a identidade de `req.session.userId` e validar autorização no backend — isso é responsabilidade do `clutchzone-backend`, não deste repo.
- Após mudanças no Vite, execute `npm run type-check` e `npm run build` em `clutchzone-app/`.
- Preserve dados e mudanças do usuário; não execute reset destrutivo do Git.
