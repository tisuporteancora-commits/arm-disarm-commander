import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticate } from "@/features/auth/auth.server";
import { errorResponse, jsonResponse, parseJsonBody } from "@/features/http/api-response";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const credentials = await parseJsonBody(request, loginSchema);
          const authenticated = await authenticate(credentials);

          if (!authenticated) {
            return jsonResponse(
              {
                authenticated: false,
                message: "Usuario ou senha invalidos.",
              },
              { status: 401 },
            );
          }

          return jsonResponse({ authenticated: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
