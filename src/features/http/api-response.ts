import type { ZodError, ZodSchema } from "zod";

export function jsonResponse<T>(data: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return Response.json(data, {
    ...init,
    headers,
  });
}

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

function isZodError(error: unknown): error is ZodError {
  return error != null && typeof error === "object" && "issues" in error;
}

export function errorResponse(error: unknown, fallbackStatus = 400): Response {
  if (isZodError(error)) {
    return jsonResponse(
      {
        error: "ValidationError",
        message: "Dados invalidos.",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  const message = error instanceof Error ? error.message : "Erro inesperado.";
  const status = message === "Nao autenticado." ? 401 : fallbackStatus;

  return jsonResponse(
    {
      error: status === 401 ? "Unauthorized" : "BadRequest",
      message,
    },
    { status },
  );
}
