import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { requireAuthenticatedSession } from "../auth/session.server";
import { alarmCommandSchema, alarmSettingsSchema } from "./alarm.schemas";
import {
  clearAlarmLogs,
  dispatchAlarmCommand,
  getAdminState,
  getCommandCompanies,
  updateSettings,
} from "./alarm.server";

function preventSensitiveCaching() {
  setResponseHeaders({
    "Cache-Control": "no-store",
    Vary: "Cookie",
  });
}

export const getCommandCompaniesFn = createServerFn({ method: "GET" }).handler(async () => {
  preventSensitiveCaching();
  await requireAuthenticatedSession();
  return getCommandCompanies();
});

export const sendAlarmCommandFn = createServerFn({ method: "POST" })
  .validator(alarmCommandSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    await requireAuthenticatedSession();
    return dispatchAlarmCommand(data);
  });

export const getAdminStateFn = createServerFn({ method: "GET" }).handler(async () => {
  preventSensitiveCaching();
  await requireAuthenticatedSession();
  return getAdminState();
});

export const saveAlarmSettingsFn = createServerFn({ method: "POST" })
  .validator(alarmSettingsSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    await requireAuthenticatedSession();
    return updateSettings(data);
  });

export const clearAlarmLogsFn = createServerFn({ method: "POST" }).handler(async () => {
  preventSensitiveCaching();
  await requireAuthenticatedSession();
  await clearAlarmLogs();
  return { success: true };
});
