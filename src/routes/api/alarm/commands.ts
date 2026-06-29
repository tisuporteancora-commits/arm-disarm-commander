import { createFileRoute } from "@tanstack/react-router";

import { alarmCommandSchema } from "@/features/alarm/alarm.schemas";
import { dispatchAlarmCommand } from "@/features/alarm/alarm.server";
import { requireAuthenticatedSession } from "@/features/auth/session.server";
import { errorResponse, jsonResponse, parseJsonBody } from "@/features/http/api-response";

export const Route = createFileRoute("/api/alarm/commands")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedSession();
          const input = await parseJsonBody(request, alarmCommandSchema);
          return jsonResponse(await dispatchAlarmCommand(input), { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
