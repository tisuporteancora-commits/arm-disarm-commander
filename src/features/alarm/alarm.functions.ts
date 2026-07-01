import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { z } from "zod";
import { requireAuthenticatedSession } from "../auth/session.server";
import { alarmCommandSchema, alarmSettingsSchema } from "./alarm.schemas";
import {
  addAlarmSchedule,
  clearAlarmLogs,
  deleteAlarmSchedule,
  dispatchAlarmCommand,
  getAdminState,
  getAlarmSchedules,
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
  return getCommandCompanies();
});

export const sendAlarmCommandFn = createServerFn({ method: "POST" })
  .validator(alarmCommandSchema)
  .handler(async ({ data }) => {
    preventSensitiveCaching();
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

export const getAlarmSchedulesFn = createServerFn({ method: "GET" }).handler(async () => {
  preventSensitiveCaching();
  return getAlarmSchedules();
});

export const createAlarmScheduleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      operator: z.string().trim().min(2, "Informe o nome do operador."),
      client: z.string().trim().regex(/^\d{4}$/, "A conta deve ter exatamente 4 digitos."),
      organization: z.string().trim().min(1, "Selecione a empresa."),
      companyName: z.string().trim().min(1),
      command: z.enum(["ARMAR", "DESARMAR"]),
      datetime: z.string().min(1, "Selecione data e hora."),
    }),
  )
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    return addAlarmSchedule(data);
  });

export const deleteAlarmScheduleFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    preventSensitiveCaching();
    await deleteAlarmSchedule(data.id);
    return { success: true };
  });
