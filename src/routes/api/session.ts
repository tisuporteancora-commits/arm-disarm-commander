import { createFileRoute } from "@tanstack/react-router";

import { currentSession } from "@/features/auth/auth.server";
import { errorResponse, jsonResponse } from "@/features/http/api-response";

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return jsonResponse(await currentSession());
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
