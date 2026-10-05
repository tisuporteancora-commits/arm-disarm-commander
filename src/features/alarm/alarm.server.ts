import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  AlarmCommand,
  AlarmCommandInput,
  AlarmCommandResult,
  AlarmLogEntry,
  AlarmProvider,
  AlarmSchedule,
  AlarmSettings,
  AlarmSettingsInput,
  Company,
  TemCommand,
  TemCommandInput,
  TemCommandResult,
  TemScheduleInput,
  TemSettings,
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
  tem: {
    baseUrl: process.env.TEM_API_URL ?? "http://192.168.0.106:8780",
    apiKey: process.env.TEM_API_KEY ?? "",
    defaultPin: process.env.TEM_DEFAULT_PIN ?? "1234",
  },
  companies: DEFAULT_COMPANIES,
};

const TEM_COMMANDS: Record<TemCommand, string> = {
  ARMAR: "arm",
  DESARMAR: "disarm",
  ISOLAR: "bypass",
  DESISOLAR: "unbypass",
};

const TEM_LOG_COMPANY: Company = { id: "TEM", name: "Centrais TEM" };

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
        tem: {
          baseUrl: parsed.settings?.tem?.baseUrl || DEFAULT_SETTINGS.tem.baseUrl,
          apiKey: parsed.settings?.tem?.apiKey || DEFAULT_SETTINGS.tem.apiKey,
          defaultPin: parsed.settings?.tem?.defaultPin ?? DEFAULT_SETTINGS.tem.defaultPin,
        },
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

function buildTemCommandUrl(tem: TemSettings): string {
  const baseUrl = tem.baseUrl.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(baseUrl) ? baseUrl : `http://${baseUrl}`;
  const url = new URL(withProtocol);
  url.pathname = "/api/v1/commands";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Returns the error reported in a 2xx TEM response body, if any. */
function readTemBodyError(body: string): string | undefined {
  if (!body) return undefined;

  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed == null || typeof parsed !== "object") return undefined;

    const record = parsed as Record<string, unknown>;
    if (record.success === false || record.ok === false) {
      const detail = record.error ?? record.message ?? body;
      return `Central TEM recusou o comando: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

class DispatchHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

async function sendReceptoraCommand(url: string): Promise<number> {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new DispatchHttpError(response.status, await buildHttpErrorMessage(response));
  }

  return response.status;
}

type TemRequest = {
  account: string;
  command: TemCommand;
  pin?: string;
  zones?: number[];
};

async function sendTemCommand(tem: TemSettings, request: TemRequest, url: string): Promise<number> {
  if (!tem.apiKey.trim()) {
    throw new Error("Chave de API TEM nao configurada.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": tem.apiKey.trim(),
    },
    body: JSON.stringify({
      account: request.account,
      command: TEM_COMMANDS[request.command],
      ...(request.pin ? { pin: request.pin } : {}),
      ...(request.zones?.length ? { params: { zones: request.zones } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new DispatchHttpError(response.status, await buildHttpErrorMessage(response));
  }

  const bodyError = readTemBodyError(await response.text().catch(() => ""));
  if (bodyError) {
    throw new DispatchHttpError(response.status, bodyError);
  }

  return response.status;
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

export async function updateSettings(settings: AlarmSettingsInput): Promise<AlarmSettings> {
  const state = await readState();
  const tem = settings.tem ?? state.settings.tem;
  const normalized: AlarmSettings = {
    targetHost: settings.targetHost.trim(),
    targetPort: settings.targetPort.trim(),
    tem: {
      baseUrl: tem.baseUrl.trim(),
      apiKey: tem.apiKey.trim(),
      defaultPin: tem.defaultPin.trim(),
    },
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
    const errorMessage = "Empresa nao encontrada.";
    await addLog({
      operator: input.operator.trim(),
      client: input.client,
      companyId: input.organization,
      companyName: input.organization,
      command: input.command,
      provider: "RECEPTORA",
      url: "-",
      status: "FAILED",
      errorMessage,
    });
    throw new Error(errorMessage);
  }

  const provider: AlarmProvider = "RECEPTORA";
  let url = "URL invalida";
  let httpStatus: number | undefined;

  try {
    url = buildCommandUrl(state.settings, input);
    httpStatus = await sendReceptoraCommand(url);

    await addLog({
      operator: input.operator.trim(),
      client: input.client,
      companyId: input.organization,
      companyName: company.name,
      command: input.command,
      provider,
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
    if (error instanceof DispatchHttpError) {
      httpStatus = error.httpStatus;
    }

    await addLog({
      operator: input.operator.trim(),
      client: input.client,
      companyId: input.organization,
      companyName: company.name,
      command: input.command,
      provider,
      url,
      status: "FAILED",
      httpStatus,
      errorMessage,
    });

    throw new Error(errorMessage);
  }
}

export async function dispatchTemCommand(input: TemCommandInput): Promise<TemCommandResult> {
  const state = await readState();
  const tem = state.settings.tem;
  const provider: AlarmProvider = "TEM";
  let url = "URL invalida";
  let httpStatus: number | undefined;
  const usesZones = input.command === "ISOLAR" || input.command === "DESISOLAR";
  const zones = usesZones ? [...new Set(input.zones ?? [])].sort((a, b) => a - b) : undefined;

  const logBase = {
    operator: input.operator.trim(),
    client: input.account,
    companyId: TEM_LOG_COMPANY.id,
    companyName: TEM_LOG_COMPANY.name,
    command: input.command,
    zones,
    provider,
  };

  try {
    url = buildTemCommandUrl(tem);
    const pin = input.pin?.trim() || tem.defaultPin || undefined;
    httpStatus = await sendTemCommand(
      tem,
      { account: input.account, command: input.command, pin, zones },
      url,
    );

    await addLog({ ...logBase, url, status: "SUCCESS", httpStatus });

    return { success: true, command: input.command, account: input.account, httpStatus };
  } catch (error) {
    const errorMessage = describeDispatchError(error);
    if (error instanceof DispatchHttpError) {
      httpStatus = error.httpStatus;
    }

    await addLog({ ...logBase, url, status: "FAILED", httpStatus, errorMessage });

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

export async function addTemSchedule(input: TemScheduleInput): Promise<AlarmSchedule> {
  return addAlarmSchedule({
    operator: input.operator.trim(),
    client: input.account,
    organization: TEM_LOG_COMPANY.id,
    companyName: TEM_LOG_COMPANY.name,
    command: input.command,
    datetime: input.datetime,
    provider: "TEM",
  });
}

export async function deleteAlarmSchedule(id: string): Promise<void> {
  const state = await readState();
  await writeState({
    ...state,
    schedules: (state.schedules || []).filter((s) => s.id !== id),
  });
}

// Background scheduler. The interval handle lives on globalThis so a module reload (dev HMR)
// replaces the running timer instead of leaving a stale copy executing outdated code.
const schedulerGlobal = globalThis as typeof globalThis & {
  __alarmSchedulerInterval?: ReturnType<typeof setInterval>;
};

function startScheduler() {
  if (schedulerGlobal.__alarmSchedulerInterval) {
    clearInterval(schedulerGlobal.__alarmSchedulerInterval);
  }

  schedulerGlobal.__alarmSchedulerInterval = setInterval(async () => {
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
          if (item.provider === "TEM" || item.organization === TEM_LOG_COMPANY.id) {
            await dispatchTemCommand({
              operator: `Agendado (${item.operator})`,
              account: item.client,
              command: item.command,
            });
          } else {
            await dispatchAlarmCommand({
              operator: `Agendado (${item.operator})`,
              client: item.client,
              organization: item.organization,
              command: item.command,
            });
          }
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

