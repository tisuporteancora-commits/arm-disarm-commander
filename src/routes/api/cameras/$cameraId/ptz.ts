import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sendPtzCommand } from "@/features/cameras/camera.server";
import { errorResponse, jsonResponse, parseJsonBody } from "@/features/http/api-response";

const bodySchema = z.object({
  action: z.enum(["up", "down", "left", "right", "zoomIn", "zoomOut", "stop"]),
  speed: z.number().min(0.05).max(1).optional(),
});

export const Route = createFileRoute("/api/cameras/$cameraId/ptz")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          const body = await parseJsonBody(request, bodySchema);
          await sendPtzCommand(params.cameraId, body.action, body.speed);
          return jsonResponse({ success: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
