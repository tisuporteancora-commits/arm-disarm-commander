import "@tanstack/react-start/server-only";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Camera } from "./camera.types";

type LiveSession = {
  cameraId: string;
  rtspUrl: string;
  process: ChildProcessWithoutNullStreams;
  buffer: Buffer;
  latestFrame: Buffer | null;
  error: string | null;
  lastAccessAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, LiveSession>();
const IDLE_MS = 30_000;

function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  try {
    const envPath = join(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const match = /(?:^|\n)FFMPEG_PATH\s*=\s*([^\r\n#]+)/.exec(readFileSync(envPath, "utf-8"));
      const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (value && existsSync(value)) return value;
    }
  } catch {
    // ignore
  }

  const candidates = [
    "C:/ffmpeg/bin/ffmpeg.exe",
    "C:/ProgramData/chocolatey/bin/ffmpeg.exe",
    join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Links/ffmpeg.exe"),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return "ffmpeg";
}

export function getFfmpegPath(): string {
  return resolveFfmpegPath();
}

function extractLatestJpeg(buffer: Buffer): { frame: Buffer | null; rest: Buffer } {
  const soi = Buffer.from([0xff, 0xd8]);
  const eoi = Buffer.from([0xff, 0xd9]);

  let searchFrom = 0;
  let lastFrame: Buffer | null = null;
  let lastEnd = 0;

  while (searchFrom < buffer.length) {
    const start = buffer.indexOf(soi, searchFrom);
    if (start < 0) break;
    const end = buffer.indexOf(eoi, start + 2);
    if (end < 0) {
      return { frame: lastFrame, rest: buffer.subarray(start) };
    }
    lastFrame = buffer.subarray(start, end + 2);
    lastEnd = end + 2;
    searchFrom = lastEnd;
  }

  return {
    frame: lastFrame,
    rest: lastEnd > 0 ? buffer.subarray(lastEnd) : buffer,
  };
}

function scheduleIdleStop(session: LiveSession) {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    const current = sessions.get(session.cameraId);
    if (!current) return;
    if (Date.now() - current.lastAccessAt >= IDLE_MS) {
      stopSession(session.cameraId);
    }
  }, IDLE_MS + 500);
}

function stopSession(cameraId: string) {
  const session = sessions.get(cameraId);
  if (!session) return;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  sessions.delete(cameraId);
  if (!session.process.killed) {
    session.process.kill();
  }
}

function startSession(camera: Camera): LiveSession {
  const ffmpeg = resolveFfmpegPath();
  const child = spawn(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      // Lower latency from RTSP over the internet.
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      "-rtsp_transport",
      "tcp",
      "-i",
      camera.rtspUrl,
      "-an",
      // Preview quality: smaller frames refresh faster in the browser.
      "-r",
      "8",
      "-vf",
      "scale=960:-2",
      "-q:v",
      "8",
      "-f",
      "mjpeg",
      "pipe:1",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  const session: LiveSession = {
    cameraId: camera.id,
    rtspUrl: camera.rtspUrl,
    process: child,
    buffer: Buffer.alloc(0),
    latestFrame: null,
    error: null,
    lastAccessAt: Date.now(),
    idleTimer: null,
  };

  child.stdout.on("data", (chunk: Buffer) => {
    session.buffer = Buffer.concat([session.buffer, chunk]);
    if (session.buffer.length > 8_000_000) {
      session.buffer = session.buffer.subarray(session.buffer.length - 2_000_000);
    }
    const parsed = extractLatestJpeg(session.buffer);
    session.buffer = parsed.rest;
    if (parsed.frame) {
      session.latestFrame = parsed.frame;
      session.error = null;
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8").trim();
    if (text) session.error = text.slice(0, 400);
  });

  child.on("error", (error) => {
    session.error = error.message.includes("ENOENT")
      ? `FFmpeg nao encontrado nesta maquina. Instale com: winget install Gyan.FFmpeg e no .env defina FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe (depois reinicie o app/PM2).`
      : `Falha no FFmpeg: ${error.message}`;
    sessions.delete(camera.id);
  });

  child.on("exit", (code) => {
    if (sessions.get(camera.id)?.process === child) {
      session.error =
        session.error ||
        (code ? `FFmpeg encerrou (codigo ${code}). Verifique RTSP e rede.` : "Stream encerrado.");
      sessions.delete(camera.id);
    }
  });

  sessions.set(camera.id, session);
  return session;
}

function ensureSession(camera: Camera): LiveSession {
  const existing = sessions.get(camera.id);
  if (existing) {
    if (existing.rtspUrl !== camera.rtspUrl) {
      stopSession(camera.id);
    } else {
      existing.lastAccessAt = Date.now();
      scheduleIdleStop(existing);
      return existing;
    }
  }

  const session = startSession(camera);
  scheduleIdleStop(session);
  return session;
}

export async function waitForFrame(camera: Camera, timeoutMs = 15_000): Promise<Buffer> {
  const session = ensureSession(camera);
  session.lastAccessAt = Date.now();
  scheduleIdleStop(session);

  if (session.latestFrame) return session.latestFrame;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (session.error && !session.latestFrame) {
      throw new Error(session.error);
    }
    if (session.latestFrame) return session.latestFrame;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  throw new Error(
    session.error ||
      "Timeout ao receber imagem da camera. Verifique RTSP, usuario/senha e FFmpeg.",
  );
}
