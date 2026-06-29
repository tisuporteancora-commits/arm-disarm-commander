import "@tanstack/react-start/server-only";

import { useSession as getServerSession } from "@tanstack/react-start/server";

type AppSession = {
  authenticated?: boolean;
  username?: string;
};

export function getAppSession() {
  return getServerSession<AppSession>({
    name: "alarm-session",
    password: process.env.ALARM_SESSION_SECRET ?? "dev-only-change-this-session-secret-32",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export async function requireAuthenticatedSession(): Promise<AppSession> {
  const session = await getAppSession();

  if (!session.data.authenticated) {
    throw new Error("Nao autenticado.");
  }

  return session.data;
}
