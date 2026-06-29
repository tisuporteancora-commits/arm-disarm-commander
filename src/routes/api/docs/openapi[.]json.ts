import { createFileRoute } from "@tanstack/react-router";

import { openApiDocument } from "@/features/docs/openapi";

export const Route = createFileRoute("/api/docs/openapi.json")({
  server: {
    handlers: {
      GET: async () => Response.json(openApiDocument),
    },
  },
});
