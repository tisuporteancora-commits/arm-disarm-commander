import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import {
  cameraIdSchema,
  cameraInputSchema,
  cameraUpdateSchema,
  ptzActionSchema,
} from "./camera.schemas";
import {
  createCamera,
  deleteCamera,
  listCameras,
  sendPtzCommand,
  updateCamera,
  warmupPtzSession,
} from "./camera.server";

function preventSensitiveCaching() {
  setResponseHeaders({
    "Cache-Control": "no-store",
    Vary: "Cookie",
  });
}

export const listCamerasFn = createServerFn({ method: "GET" }).handler(async () => {
  preventSensitiveCaching();
  return listCameras();
});

export const createCameraFn = createServerFn({ method: "POST" })
  .validator(cameraInputSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    return createCamera(data);
  });

export const updateCameraFn = createServerFn({ method: "POST" })
  .validator(cameraUpdateSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    const { id, ...input } = data;
    return updateCamera(id, input);
  });

export const deleteCameraFn = createServerFn({ method: "POST" })
  .validator(cameraIdSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    await deleteCamera(data.id);
    return { success: true };
  });

export const sendPtzCommandFn = createServerFn({ method: "POST" })
  .validator(ptzActionSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    await sendPtzCommand(data.id, data.action, data.speed);
    return { success: true };
  });

export const warmupPtzSessionFn = createServerFn({ method: "POST" })
  .validator(cameraIdSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    return warmupPtzSession(data.id);
  });
