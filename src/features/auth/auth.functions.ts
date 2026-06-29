import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";

import { authenticate, clearSession, currentSession } from "./auth.server";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

function preventSensitiveCaching() {
  setResponseHeaders({
    "Cache-Control": "no-store",
    Vary: "Cookie",
  });
}

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  preventSensitiveCaching();
  return currentSession();
});

export const loginFn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    const authenticated = await authenticate(data);
    return { authenticated };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  preventSensitiveCaching();
  await clearSession();
  return { authenticated: false };
});
