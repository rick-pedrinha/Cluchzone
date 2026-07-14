# Kubernetes

Os manifests em `base/` preparam a API para rolling deployment, três réplicas mínimas, autoscaling, probes e proteção contra interrupções voluntárias.

Antes do deploy, o pipeline deve:

1. Publicar uma imagem imutável e substituir `replace-with-immutable-tag` via Kustomize.
2. Criar `clutchzone-backend-config` com `NODE_ENV`, `PORT`, `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGINS`, `TRUST_PROXY`, `OUTBOX_EXCHANGE`, `EVENT_MATCH_QUEUE`, `OUTBOX_BATCH_SIZE`, `OUTBOX_LEASE_MS` e `OUTBOX_POLL_MS`.
3. Criar `clutchzone-backend-secrets` no cofre/operador de segredos com `DATABASE_URL`, `SESSION_SECRET`, `EVENT_BROKER_URL` e, quando usado, `STEAM_API_KEY`.
4. Aplicar `migration-job.yaml` uma única vez e aguardar sucesso.
5. Aplicar `base/` e só promover o tráfego quando `/ready` responder 200.

O Job de migration fica fora do `kustomization.yaml` deliberadamente: migrations não devem ser executadas por cada réplica nem reaplicadas a cada reconciliação do Deployment.

O HPA exige Metrics Server. Escala baseada na fila de servidores de jogo será adicionada ao deployment do Game Server Orchestrator, não à API HTTP.
