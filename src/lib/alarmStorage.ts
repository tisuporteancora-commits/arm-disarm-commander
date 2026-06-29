export type Empresa = { id: string; nome: string };
export type LogEntry = {
  id: string;
  timestamp: string;
  operator: string;
  client: string;
  empresaId: string;
  empresaNome: string;
  command: "ARMAR" | "DESARMAR";
  url: string;
};
export type Settings = {
  ip: string;
  port: string;
  empresas: Empresa[];
};

const SETTINGS_KEY = "alarm.settings";
const LOGS_KEY = "alarm.logs";
const AUTH_KEY = "alarm.auth";
const CREDS_KEY = "alarm.creds";
const MAX_LOGS = 500;

export const DEFAULT_EMPRESAS: Empresa[] = [
  { id: "3", nome: "ANCORA SEGURANÇA" },
  { id: "4", nome: "CI SISTEMAS" },
  { id: "5", nome: "EDINHO ALARMES" },
  { id: "6", nome: "NF MONITORAMENTO" },
  { id: "7", nome: "PROTEJA" },
  { id: "8", nome: "2001 TELECOMUNICAÇÕES" },
  { id: "9", nome: "MSEG" },
  { id: "10", nome: "ELITE MONITORAMENTO" },
  { id: "11", nome: "MRE SEGURANÇA" },
  { id: "12", nome: "GTX TECHNOLOGY" },
  { id: "13", nome: "E-BADAN" },
  { id: "14", nome: "BLETEC" },
  { id: "15", nome: "TELEALARME" },
];

const DEFAULT_SETTINGS: Settings = {
  ip: "192.168.0.120",
  port: "9000",
  empresas: DEFAULT_EMPRESAS,
};

const DEFAULT_CREDS = { username: "admin", password: "admin" };

function isBrowser() {
  return typeof window !== "undefined";
}

export function getSettings(): Settings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Settings;
    return {
      ip: parsed.ip || DEFAULT_SETTINGS.ip,
      port: parsed.port || DEFAULT_SETTINGS.port,
      empresas: Array.isArray(parsed.empresas) && parsed.empresas.length > 0
        ? parsed.empresas
        : DEFAULT_SETTINGS.empresas,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (!isBrowser()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getLogs(): LogEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

export function addLog(entry: Omit<LogEntry, "id" | "timestamp">) {
  if (!isBrowser()) return;
  const logs = getLogs();
  const newEntry: LogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const updated = [newEntry, ...logs].slice(0, MAX_LOGS);
  localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
}

export function clearLogs() {
  if (!isBrowser()) return;
  localStorage.removeItem(LOGS_KEY);
}

export function getCreds() {
  if (!isBrowser()) return DEFAULT_CREDS;
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return DEFAULT_CREDS;
    return JSON.parse(raw) as { username: string; password: string };
  } catch {
    return DEFAULT_CREDS;
  }
}

export function saveCreds(creds: { username: string; password: string }) {
  if (!isBrowser()) return;
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function setAuthenticated(value: boolean) {
  if (!isBrowser()) return;
  if (value) localStorage.setItem(AUTH_KEY, "1");
  else localStorage.removeItem(AUTH_KEY);
}

export function buildCommandUrl(opts: {
  ip: string;
  port: string;
  client: string;
  organization: string;
  identification: "E" | "R";
}) {
  const { ip, port, client, organization, identification } = opts;
  return `http://${ip}:${port}/api/v1/events?client=${encodeURIComponent(
    client,
  )}&partition=01&organization=${encodeURIComponent(
    organization,
  )}&occurrence=401&identification=${identification}&sector=120`;
}