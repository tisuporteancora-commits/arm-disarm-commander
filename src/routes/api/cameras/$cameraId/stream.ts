import { createFileRoute } from "@tanstack/react-router";

import { getCameraById } from "@/features/cameras/camera.server";
import { waitForFrame } from "@/features/cameras/camera.stream.server";

export const Route = createFileRoute("/api/cameras/$cameraId/stream")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const camera = await getCameraById(params.cameraId);
        if (!camera) {
          return new Response("Camera nao encontrada.", { status: 404 });
        }

        try {
          const frame = await waitForFrame(camera, 15_000);
          return new Response(new Uint8Array(frame), {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao capturar imagem.";
          return new Response(message, {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
