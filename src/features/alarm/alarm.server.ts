import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  AlarmCommand,
  AlarmCommandInput,
  AlarmCommandResult,
  AlarmLogEntry,
  AlarmSchedule,
  AlarmSettings,
  Company,
} from "./alarm.types";

const MAX_LOGS = 500;
const STATE_FILE = join(process.cwd(), ".app-data", "alarm-state.json");

const DEFAULT_COMPANIES: Company[] = [
  { id: "3", name: "ANCORA SEGURANCA" },
  { id: "4", name: "CI SISTEMAS" },
  { id: "5", name: "EDINHO ALARMES" },
  { id: "6", name: "NF MONITORAMENTO" },
  { id: "7", name: "PROTEJA" },
  { id: "8", name: "2001 TELECOMUNICACOES" },
  { id: "9", name: "MSEG" },
  { id: "10", name: "ELITE MONITORAMENTO" },
  { id: "11", name: "MRE SEGURANCA" },
  { id: "12", name: "GTX TECHNOLOGY" },
  { id: "13", name: "E-BADAN" },
  { id: "14", name: "BLETEC" },
  { id: "15", name: "TELEALARME" },
];

const DEFAULT_SETTINGS: AlarmSettings = {
  targetHost: process.env.ALARM_TARGET_HOST ?? "192.168.0.120",
  targetPort: process.env.ALARM_TARGET_PORT ?? "9000",
  companies: DEFAULT_COMPANIES,
};

type AlarmState = {
  settings: AlarmSettings;
  logs: AlarmLogEntry[];
  credentials?: { username: string; password: string };
  schedules?: AlarmSchedule[];
};

function emptyState(): AlarmState {
  return {
    settings: DEFAULT_SETTINGS,
    logs: [],
    schedules: [],
  };
}

async function readState(): Promise<AlarmState> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AlarmState>;

    return {
      settings: {
        targetHost: parsed.settings?.targetHost || DEFAULT_SETTINGS.targetHost,
        targetPort: parsed.settings?.targetPort || DEFAULT_SETTINGS.targetPort,
        companies:
          Array.isArray(parsed.settings?.companies) && parsed.settings.companies.length > 0
            ? parsed.settings.companies
            : DEFAULT_SETTINGS.companies,
      },
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      credentials: parsed.credentials,
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    };
  } catch {
    return emptyState();
  }
}

async function writeState(state: AlarmState): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

export async function getStoredCredentials() {
  const state = await readState();
  return state.credentials || {
    username: process.env.ALARM_ADMIN_USERNAME ?? "admin",
    password: process.env.ALARM_ADMIN_PASSWORD ?? "admin",
  };
}

export async function setStoredCredentials(credentials: { username: string; password: string }): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    credentials: {
      username: credentials.username.trim(),
      password: credentials.password,
    },
  });
}

function commandIdentification(command: AlarmCommand): "E" | "R" {
  return command === "ARMAR" ? "R" : "E";
}

function buildTargetBaseUrl(settings: AlarmSettings): URL {
  const targetHost = settings.targetHost.trim();
  const targetPort = settings.targetPort.trim();
  const targetWithProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(targetHost)
    ? targetHost
    : `http://${targetHost}`;
  const baseUrl = new URL(targetWithProtocol);

  if (targetPort) {
    baseUrl.port = targetPort;
  }

  baseUrl.pathname = "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  return baseUrl;
}

function buildCommandUrl(settings: AlarmSettings, input: AlarmCommandInput): string {
  const url = new URL("/api/v1/events", buildTargetBaseUrl(settings));
  url.searchParams.set("client", input.client);
  url.searchParams.set("partition", "01");
  url.searchParams.set("organization", input.organization);
  url.searchParams.set("occurrence", "401");
  url.searchParams.set("identification", commandIdentification(input.command));
  url.searchParams.set("sector", "120");
  return url.toString();
}

function describeDispatchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Erro desconhecido.";
  }

  const cause = "cause" in error ? error.cause : undefined;
  if (cause != null && typeof cause === "object" && "code" in cause) {
    const code = String(cause.code);
    const message = "message" in cause ? String(cause.message) : error.message;
    return `Falha ao acessar a central (${code}): ${message}`;
  }

  if (error.message === "fetch failed") {
    return "Falha ao acessar a central. Verifique host, porta e conectividade.";
  }

  return error.message;
}

async function buildHttpErrorMessage(response: Response): Promise<string> {
  const responseBody = await response
    .clone()
    .text()
    .then((body) => body.trim())
    .catch(() => "");

  const statusMessage =
    response.status === 401
      ? "Central recusou o comando: nao autorizado."
      : `Central respondeu com HTTP ${response.status}.`;

  if (!responseBody) {
    return statusMessage;
  }

  return `${statusMessage} Detalhe: ${responseBody.slice(0, 500)}`;
}

async function addLog(entry: Omit<AlarmLogEntry, "id" | "timestamp">): Promise<void> {
  const state = await readState();
  const logEntry: AlarmLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  await writeState({
    ...state,
    logs: [logEntry, ...state.logs].slice(0, MAX_LOGS),
  });
}

export async function getCommandCompanies(): Promise<Company[]> {
  const state = await readState();
  return state.settings.companies;
}

export async function getAdminState(): Promise<AlarmState> {
  return readState();
}

export async function updateSettings(settings: AlarmSettings): Promise<AlarmSettings> {
  const state = await readState();
  const normalized: AlarmSettings = {
    targetHost: settings.targetHost.trim(),
    targetPort: settings.targetPort.trim(),
    companies: settings.companies.map((company) => ({
      id: company.id.trim(),
      name: company.name.trim(),
    })),
  };

  await writeState({ ...state, settings: normalized });
  return normalized;
}

export async function clearAlarmLogs(): Promise<void> {
  const state = await readState();
  await writeState({ ...state, logs: [] });
}

export async function dispatchAlarmCommand(input: AlarmCommandInput): Promise<AlarmCommandResult> {
  const state = await readState();
  const company = state.settings.companies.find((item) => item.id === input.organization);

  if (!company) {
    throw new Error("Empresa nao encontrada.");
  }

  let url = "URL invalida";
  let httpStatus: number | undefined;

  try {
    url = buildCommandUrl(state.settings, input);

    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });

    httpStatus = response.status;

    if (!response.ok) {
      throw new Error(await buildHttpErrorMessage(response));
    }

    await addLog({
      operator: input.operator.trim(),
      client: input.client,
      companyId: input.organization,
      companyName: company.name,
      command: input.command,
      url,
      status: "SUCCESS",
      httpStatus,
    });

    return {
      success: true,
      command: input.command,
      client: input.client,
      organization: input.organization,
      companyName: company.name,
      httpStatus,
    };
  } catch (error) {
    const errorMessage = describeDispatchError(error);

    await addLog({
      operator: input.operator.trim(),
      client: input.client,
      companyId: input.organization,
      companyName: company.name,
      command: input.command,
      url,
      status: "FAILED",
      httpStatus,
      errorMessage,
    });

    throw new Error(errorMessage);
  }
}

export async function getAlarmSchedules(): Promise<AlarmSchedule[]> {
  const state = await readState();
  return state.schedules || [];
}

export async function addAlarmSchedule(input: Omit<AlarmSchedule, "id">): Promise<AlarmSchedule> {
  const state = await readState();
  const schedule: AlarmSchedule = {
    ...input,
    id: crypto.randomUUID(),
  };

  await writeState({
    ...state,
    schedules: [...(state.schedules || []), schedule],
  });

  return schedule;
}

export async function deleteAlarmSchedule(id: string): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    schedules: (state.schedules || []).filter((s) => s.id !== id),
  });
}

// Background scheduler
let schedulerIntervalId: any = null;

function startScheduler() {
  if (schedulerIntervalId) return;

  schedulerIntervalId = setInterval(async () => {
    try {
      const state = await readState();
      const schedules = state.schedules || [];
      if (schedules.length === 0) return;

      const now = new Date();
      const due = schedules.filter((s) => new Date(s.datetime) <= now);
      if (due.length === 0) return;

      const remaining = schedules.filter((s) => new Date(s.datetime) > now);

      // Save remaining first to prevent multiple execution attempts in case of crashes
      await writeState({
        ...state,
        schedules: remaining,
      });

      console.log(`[Scheduler] Executando ${due.length} comandos agendados...`);

      for (const item of due) {
        try {
          await dispatchAlarmCommand({
            operator: `Agendado (${item.operator})`,
            client: item.client,
            organization: item.organization,
            command: item.command,
          });
          console.log(`[Scheduler] Comando ${item.command} executado para conta ${item.client}.`);
        } catch (error) {
          console.error(`[Scheduler] Falha ao executar comando agendado para conta ${item.client}:`, error);
        }
      }
    } catch (err) {
      console.error("[Scheduler] Erro no loop de agendamentos:", err);
    }
  }, 15_000); // Check every 15 seconds
}

// Start scheduler immediately on module load
startScheduler();

