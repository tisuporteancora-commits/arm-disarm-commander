import { createFileRoute } from "@tanstack/react-router";

import { alarmSettingsSchema } from "@/features/alarm/alarm.schemas";
import { getAdminState, updateSettings } from "@/features/alarm/alarm.server";
import { requireAuthenticatedSession } from "@/features/auth/session.server";
import { errorResponse, jsonResponse, parseJsonBody } from "@/features/http/api-response";

export const Route = createFileRoute("/api/alarm/settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireAuthenticatedSession();
          const state = await getAdminState();
          return jsonResponse(state.settings);
        } catch (error) {
          return errorResponse(error);
        }
      },
      PUT: async ({ request }) => {
        try {
          await requireAuthenticatedSession();
          const settings = await parseJsonBody(request, alarmSettingsSchema);
          return jsonResponse(await updateSettings(settings));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
