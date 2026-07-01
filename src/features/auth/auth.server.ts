import "@tanstack/react-start/server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { getAppSession } from "./session.server";

type Credentials = {
  username: string;
  password: string;
};

import { getStoredCredentials } from "../alarm/alarm.server";

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function authenticate(credentials: Credentials): Promise<boolean> {
  const configured = await getStoredCredentials();
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
