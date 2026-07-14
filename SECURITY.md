# Política de segurança

## Autenticação

O CLUTCHZONE usa Steam OpenID 2.0. Senhas da Steam nunca devem ser solicitadas, recebidas, registradas ou armazenadas. O `SteamID64` só é aceito após validação da asserção pelo provedor Steam; valores enviados pelo frontend são ignorados.

Sessões usam cookies `HttpOnly`, `Secure` em produção e `SameSite=None` para frontend separado. O identificador da sessão e o rate limiting ficam no PostgreSQL, permitindo múltiplas instâncias sem afinidade de sessão.

## Segredos

- Nunca versione `.env`, chaves Steam, segredos de sessão, credenciais PostgreSQL ou contas de serviço.
- Revogue imediatamente qualquer segredo privado que apareça em commit, log ou artefato.
- A auditoria desta mudança não encontrou chave administrativa, chave privada ou segredo de sessão preenchido. A antiga configuração web Firebase versionada foi removida por não ser mais usada; chaves web Firebase são identificadores públicos, mas devem permanecer restritas por domínio e API no Google Cloud.
- Logs estruturados redigem cookies, autorização, assinatura OpenID e nomes de segredos.

## Relato de vulnerabilidades

Use um GitHub Security Advisory privado no repositório. Não publique prova de conceito, token, cookie ou dado pessoal em issue pública.

## Escopo ainda não endurecido

Equipes, campeonatos, chat e pagamentos vieram de uma implementação baseada em documentos agregados e cache local. A autenticação não transforma essas regras antigas em autorização segura. Antes de produção, modele ownership/membership no PostgreSQL e imponha autorização no backend para cada mutação.
