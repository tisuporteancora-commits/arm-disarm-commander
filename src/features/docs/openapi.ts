export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Arm Disarm Commander API",
    version: "1.0.0",
    description:
      "API para autenticar operador administrativo, configurar a central e disparar comandos de arme/desarme.",
  },
  servers: [
    {
      url: "http://127.0.0.1:8080",
      description: "Servidor local",
    },
  ],
  tags: [{ name: "Auth" }, { name: "Alarm" }, { name: "Docs" }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "alarm-session",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "admin" },
          password: { type: "string", example: "change-me" },
        },
      },
      SessionResponse: {
        type: "object",
        properties: {
          authenticated: { type: "boolean" },
          username: { type: "string", nullable: true },
        },
      },
      Company: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", example: "3" },
          name: { type: "string", example: "ANCORA SEGURANCA" },
        },
      },
      AlarmSettings: {
        type: "object",
        required: ["targetHost", "targetPort", "companies"],
        properties: {
          targetHost: {
            type: "string",
            example: "192.168.0.120",
            description:
              "Host ou IP da central que recebe o disparo. Usado para formar http://targetHost:targetPort/api/v1/events.",
          },
          targetPort: { type: "string", example: "9000" },
          companies: {
            type: "array",
            items: { $ref: "#/components/schemas/Company" },
          },
        },
      },
      AlarmCommandRequest: {
        type: "object",
        required: ["operator", "client", "organization", "command"],
        properties: {
          operator: { type: "string", example: "Alison" },
          client: { type: "string", pattern: "^\\d{4}$", example: "1234" },
          organization: { type: "string", example: "3" },
          command: { type: "string", enum: ["ARMAR", "DESARMAR"], example: "ARMAR" },
        },
      },
      AlarmCommandResult: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          command: { type: "string", enum: ["ARMAR", "DESARMAR"] },
          client: { type: "string" },
          organization: { type: "string" },
          companyName: { type: "string" },
          httpStatus: { type: "number" },
        },
      },
      AlarmLogEntry: {
        type: "object",
        properties: {
          id: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          operator: { type: "string" },
          client: { type: "string" },
          companyId: { type: "string" },
          companyName: { type: "string" },
          command: { type: "string", enum: ["ARMAR", "DESARMAR"] },
          url: { type: "string" },
          status: { type: "string", enum: ["SUCCESS", "FAILED"] },
          httpStatus: { type: "number" },
          errorMessage: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/session": {
      get: {
        tags: ["Auth"],
        summary: "Retorna a sessao atual",
        responses: {
          "200": {
            description: "Sessao atual",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Autentica e cria cookie HttpOnly",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Autenticado" },
          "401": { description: "Credenciais invalidas" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Finaliza a sessao",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Sessao encerrada" },
        },
      },
    },
    "/api/alarm/settings": {
      get: {
        tags: ["Alarm"],
        summary: "Lista configuracao da central",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Configuracao atual",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlarmSettings" },
              },
            },
          },
          "401": { description: "Nao autenticado" },
        },
      },
      put: {
        tags: ["Alarm"],
        summary: "Atualiza host, porta e empresas",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AlarmSettings" },
            },
          },
        },
        responses: {
          "200": { description: "Configuracao salva" },
          "401": { description: "Nao autenticado" },
          "422": { description: "Dados invalidos" },
        },
      },
    },
    "/api/alarm/commands": {
      post: {
        tags: ["Alarm"],
        summary: "Dispara comando de arme ou desarme",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AlarmCommandRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Comando enviado para a central",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlarmCommandResult" },
              },
            },
          },
          "400": { description: "Falha no disparo" },
          "401": { description: "Nao autenticado" },
          "422": { description: "Dados invalidos" },
        },
      },
    },
    "/api/alarm/logs": {
      get: {
        tags: ["Alarm"],
        summary: "Lista logs de comandos",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Logs",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AlarmLogEntry" },
                },
              },
            },
          },
          "401": { description: "Nao autenticado" },
        },
      },
      delete: {
        tags: ["Alarm"],
        summary: "Limpa logs de comandos",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "Logs removidos" },
          "401": { description: "Nao autenticado" },
        },
      },
    },
    "/api/docs/openapi.json": {
      get: {
        tags: ["Docs"],
        summary: "Documento OpenAPI",
        responses: {
          "200": { description: "OpenAPI JSON" },
        },
      },
    },
  },
} as const;
