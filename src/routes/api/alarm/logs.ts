import { createFileRoute } from "@tanstack/react-router";

import { clearAlarmLogs, getAdminState } from "@/features/alarm/alarm.server";
import { requireAuthenticatedSession } from "@/features/auth/session.server";
import { errorResponse, jsonResponse } from "@/features/http/api-response";

export const Route = createFileRoute("/api/alarm/logs")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireAuthenticatedSession();
          const state = await getAdminState();
          return jsonResponse(state.logs);
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async () => {
        try {
          await requireAuthenticatedSession();
          await clearAlarmLogs();
          return jsonResponse({ success: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
