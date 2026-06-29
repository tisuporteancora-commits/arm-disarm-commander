# Arm Disarm Commander

Aplicacao para enviar comandos remotos de arme e desarme para uma central de alarmes por HTTP.

O fluxo principal e simples:

1. O operador faz login.
2. Seleciona conta, empresa e comando.
3. O servidor monta a URL da central.
4. O servidor dispara o comando.
5. A tentativa fica registrada como sucesso ou falha.

## Requisitos

- Node.js 22 ou superior
- npm instalado

As dependencias atuais do TanStack exigem Node mais novo. Node 20.18 nao e suficiente.

## Instalacao

```powershell
npm install
```

## Configuracao

Crie um `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Variaveis principais:

```env
ALARM_ADMIN_USERNAME=admin
ALARM_ADMIN_PASSWORD=change-me
ALARM_SESSION_SECRET=change-this-session-secret-with-at-least-32-chars
ALARM_TARGET_HOST=192.168.0.120
ALARM_TARGET_PORT=9000
```

`ALARM_TARGET_HOST` e o host ou IP da central/sistema que recebe os disparos.
Junto com `ALARM_TARGET_PORT`, ele forma:

```text
http://ALARM_TARGET_HOST:ALARM_TARGET_PORT/api/v1/events
```

Exemplo final:

```text
http://192.168.0.120:9000/api/v1/events?client=1234&partition=01&organization=3&occurrence=401&identification=R&sector=120
```

## Rodando

```powershell
npm start
```

Por padrao o Vite sobe em:

```text
http://127.0.0.1:8080
```

## Banco de dados

Nao ha banco de dados.

O comando e instantaneo: a aplicacao recebe a acao, dispara para a central e registra o resultado localmente.

Os dados locais ficam em:

```text
.app-data/alarm-state.json
```

Esse arquivo e criado automaticamente em runtime e nao deve ser commitado. Ele guarda:

- host e porta configurados pela tela admin
- lista de empresas
- ultimos logs de comandos

## Logs

O sistema registra sucessos e falhas.

Cada log inclui:

- data/hora
- operador
- conta
- empresa
- comando
- URL enviada
- status `SUCCESS` ou `FAILED`
- HTTP status quando houver resposta
- mensagem de erro quando houver falha

Os ultimos 500 registros ficam em `.app-data/alarm-state.json`.

## API

Rotas REST disponiveis:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Faz login e cria cookie HttpOnly |
| `POST` | `/api/auth/logout` | Encerra a sessao |
| `GET` | `/api/session` | Retorna a sessao atual |
| `GET` | `/api/alarm/settings` | Lista configuracao da central |
| `PUT` | `/api/alarm/settings` | Atualiza host, porta e empresas |
| `POST` | `/api/alarm/commands` | Envia comando de arme/desarme |
| `GET` | `/api/alarm/logs` | Lista logs |
| `DELETE` | `/api/alarm/logs` | Limpa logs |

## Swagger

Com a aplicacao rodando:

```text
http://127.0.0.1:8080/docs
```

OpenAPI JSON:

```text
http://127.0.0.1:8080/api/docs/openapi.json
```

## Postman

A collection esta em:

```text
docs/postman/arm-disarm-commander.postman_collection.json
```

Importe no Postman e ajuste as variaveis:

- `baseUrl`
- `username`
- `password`

Os requests mutaveis enviam o header `Origin: {{baseUrl}}`, necessario por causa da protecao CSRF.

## Arquitetura

Organizacao principal:

```text
src/features/alarm
src/features/auth
src/features/docs
src/features/http
src/routes
```

Regras praticas:

- UI fica em `src/routes`.
- Regras de comando ficam em `src/features/alarm`.
- Sessao e login ficam em `src/features/auth`.
- Integracao com a central roda no servidor, nunca direto no browser.
- Validacoes usam Zod antes de chamar os use cases.

## Validacao

```powershell
npm run build
```

O lint global pode ser ruidoso por causa de arquivos gerados/template. Para alteracoes focadas, rode ESLint nos arquivos TS/TSX modificados.
