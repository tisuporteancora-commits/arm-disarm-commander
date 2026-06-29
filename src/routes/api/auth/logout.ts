import { createFileRoute } from "@tanstack/react-router";

import { clearSession } from "@/features/auth/auth.server";
import { errorResponse, jsonResponse } from "@/features/http/api-response";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        try {
          await clearSession();
          return jsonResponse({ authenticated: false });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
