# Host de partidas CS2

Este diretório contém a imagem do servidor dedicado. Ela usa SteamCMD para instalar/atualizar o AppID `730` em um volume Docker persistente e inicia `cs2 -dedicated`. O primeiro provisionamento baixa dezenas de gigabytes e pode levar bastante tempo.

A imagem base está fixada por digest para builds reproduzíveis. Atualize esse digest de forma intencional depois de validar uma nova versão da imagem SteamCMD.

## Pré-requisitos

- host Linux com Docker e portas UDP/TCP liberadas;
- banco PostgreSQL acessível pelo worker;
- um GSLT de CS2 válido e exclusivo para este slot;
- a mesma `CS2_SECRET_KEY` de 64 caracteres hexadecimais no backend web e no worker.

O worker atual oferece um slot por host/GSLT. Para paralelismo real, execute vários workers com portas, diretórios e GSLTs distintos, ou implemente um agendador de slots.

## Preparação

```bash
docker build -t clutchzone/cs2-server:local infra/cs2-server
mkdir -p /var/lib/clutchzone/cs2-secrets
chmod 700 /var/lib/clutchzone/cs2-secrets
```

Defina no host, sem colocar valores secretos no Git:

```dotenv
DATABASE_URL=postgresql://...
CS2_SECRET_KEY=<64 caracteres hexadecimais>
CS2_GSLT=<token criado na Steam para AppID 730>
CS2_PUBLIC_HOST=cs2.seudominio.com
CS2_SERVER_IMAGE=clutchzone/cs2-server:local
CS2_SECRET_DIR=/var/lib/clutchzone/cs2-secrets
CS2_GAME_PORT=27015
CS2_RCON_PORT=27015
```

Depois de aplicar as migrations, inicie o worker no host:

```bash
cd backend
npm ci
npm run migrate:deploy
npm run worker:cs2:start
```

O backend do site não acessa o socket Docker. Ele apenas grava pedidos autenticados no PostgreSQL; o worker consome esses pedidos, executa Docker/RCON e grava o estado de volta. RCON oferece somente quatro ações predefinidas: pausar, retomar, reiniciar a partida e liberar o servidor.
