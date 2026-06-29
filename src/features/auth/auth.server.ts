import "@tanstack/react-start/server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { getAppSession } from "./session.server";

type Credentials = {
  username: string;
  password: string;
};

function configuredCredentials(): Credentials {
  return {
    username: process.env.ALARM_ADMIN_USERNAME ?? "admin",
    password: process.env.ALARM_ADMIN_PASSWORD ?? "admin",
  };
}

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function authenticate(credentials: Credentials): Promise<boolean> {
  const configured = configuredCredentials();
  const validUsername = secureEqual(credentials.username, configured.username);
  const validPassword = secureEqual(credentials.password, configured.password);

  if (!validUsername || !validPassword) {
    return false;
  }

  const session = await getAppSession();
  await session.update({
    authenticated: true,
    username: configured.username,
  });

  return true;
}

export async function clearSession(): Promise<void> {
  const session = await getAppSession();
  await session.clear();
}

export async function currentSession() {
  const session = await getAppSession();

  return {
    authenticated: session.data.authenticated === true,
    username: session.data.username ?? null,
  };
}
