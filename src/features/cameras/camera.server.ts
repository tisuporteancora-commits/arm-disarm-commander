import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { Cam } from "onvif";

import { getFfmpegPath as resolveFfmpegBinary } from "./camera.stream.server";
import type { Camera, CameraInput, CameraPublic, PtzAction } from "./camera.types";

const STATE_FILE = join(process.cwd(), ".app-data", "alarm-state.json");
const PTZ_SPEED = 0.55;

type StoredState = {
  cameras?: Camera[];
  [key: string]: unknown;
};

type CamInstance = InstanceType<typeof Cam>;

async function readStoredState(): Promise<StoredState> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
}

async function writeStoredState(state: StoredState): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function hostFromRtsp(rtspUrl: string): string {
  try {
    const url = new URL(rtspUrl);
    return url.hostname;
  } catch {
    return "";
  }
}

function toPublic(camera: Camera): CameraPublic {
  const { password: _password, ...rest } = camera;
  return { ...rest, hasPassword: Boolean(camera.password) };
}

export function getFfmpegPath(): string {
  return resolveFfmpegBinary();
}

export async function listCameras(): Promise<CameraPublic[]> {
  const state = await readStoredState();
  return (state.cameras ?? []).map(toPublic);
}

export async function getCameraById(id: string): Promise<Camera | undefined> {
  const state = await readStoredState();
  return (state.cameras ?? []).find((camera) => camera.id === id);
}

export async function createCamera(input: CameraInput): Promise<CameraPublic> {
  const state = await readStoredState();
  const cameras = state.cameras ?? [];
  const onvifHost = input.onvifHost?.trim() || hostFromRtsp(input.rtspUrl);

  if (!onvifHost) {
    throw new Error("Informe o host ONVIF ou use uma URL RTSP com IP/hostname.");
  }

  const camera: Camera = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    rtspUrl: input.rtspUrl.trim(),
    onvifHost,
    onvifPort: input.onvifPort ?? 80,
    username: input.username.trim(),
    password: input.password,
    createdAt: new Date().toISOString(),
  };

  await writeStoredState({ ...state, cameras: [...cameras, camera] });
  return toPublic(camera);
}

export async function updateCamera(
  id: string,
  input: CameraInput & { password?: string },
): Promise<CameraPublic> {
  const state = await readStoredState();
  const cameras = state.cameras ?? [];
  const index = cameras.findIndex((camera) => camera.id === id);

  if (index < 0) {
    throw new Error("Camera nao encontrada.");
  }

  const current = cameras[index];
  const onvifHost = input.onvifHost?.trim() || hostFromRtsp(input.rtspUrl) || current.onvifHost;
  const password = input.password?.trim() ? input.password : current.password;

  const updated: Camera = {
    ...current,
    name: input.name.trim(),
    rtspUrl: input.rtspUrl.trim(),
    onvifHost,
    onvifPort: input.onvifPort ?? current.onvifPort,
    username: input.username.trim(),
    password,
  };

  const next = [...cameras];
  next[index] = updated;
  await writeStoredState({ ...state, cameras: next });
  dropOnvifSession(id);
  return toPublic(updated);
}

export async function deleteCamera(id: string): Promise<void> {
  const state = await readStoredState();
  const cameras = (state.cameras ?? []).filter((camera) => camera.id !== id);
  await writeStoredState({ ...state, cameras });
  dropOnvifSession(id);
}

type OnvifSession = {
  key: string;
  cam: CamInstance;
  profileToken: string;
  lastUsedAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const onvifSessions = new Map<string, OnvifSession>();
const ONVIF_IDLE_MS = 60_000;

function sessionKey(camera: Camera): string {
  return [
    camera.id,
    camera.onvifHost,
    camera.onvifPort,
    camera.username,
    camera.password,
  ].join("|");
}

function resolveProfileToken(cam: CamInstance): string {
  const fromActive = cam.activeSource?.profileToken;
  if (fromActive) return fromActive;

  const fromSources = cam.activeSources?.find((source) => source.profileToken)?.profileToken;
  if (fromSources) return fromSources;

  const profiles = cam.profiles ?? [];
  for (const profile of profiles) {
    const token =
      (profile as { $?: { token?: string }; token?: string }).$?.token ||
      (profile as { token?: string }).token;
    if (token) return token;
  }

  throw new Error(
    "ONVIF conectou, mas nenhum perfil PTZ foi encontrado. Confirme porta HTTP (9089), usuario e senha.",
  );
}

function dropOnvifSession(cameraId: string) {
  for (const [id, session] of onvifSessions) {
    if (id === cameraId || session.key.startsWith(`${cameraId}|`)) {
      if (session.idleTimer) clearTimeout(session.idleTimer);
      onvifSessions.delete(id);
    }
  }
}

function touchOnvifSession(session: OnvifSession, cameraId: string) {
  session.lastUsedAt = Date.now();
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    const current = onvifSessions.get(cameraId);
    if (current && Date.now() - current.lastUsedAt >= ONVIF_IDLE_MS) {
      onvifSessions.delete(cameraId);
    }
  }, ONVIF_IDLE_MS + 500);
}

function connectOnvif(camera: Camera): Promise<CamInstance> {
  return new Promise((resolve, reject) => {
    const cam = new Cam(
      {
        hostname: camera.onvifHost,
        username: camera.username,
        password: camera.password,
        port: camera.onvifPort || 9089,
        timeout: 8_000,
        // Keep the host/port we configured (needed for cameras behind public IP/NAT).
        preserveAddress: true,
      },
      (error: Error | null) => {
        if (error) {
          reject(new Error(`Falha ao conectar ONVIF: ${error.message}`));
          return;
        }
        resolve(cam);
      },
    );
  });
}

async function ensureProfiles(cam: CamInstance): Promise<string> {
  if (!cam.profiles?.length || !cam.activeSource?.profileToken) {
    const getProfiles = promisify(cam.getProfiles.bind(cam)) as () => Promise<unknown>;
    try {
      await getProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      throw new Error(`Falha ao obter perfis ONVIF: ${message}`);
    }
  }

  const token = resolveProfileToken(cam);
  if (!cam.activeSource) {
    cam.activeSource = {
      sourceToken: "",
      profileToken: token,
      videoSourceConfigurationToken: "",
    };
  } else if (!cam.activeSource.profileToken) {
    cam.activeSource.profileToken = token;
  }
  return token;
}

async function getOnvifSession(camera: Camera): Promise<OnvifSession> {
  const key = sessionKey(camera);
  const cached = onvifSessions.get(camera.id);
  if (cached && cached.key === key) {
    touchOnvifSession(cached, camera.id);
    return cached;
  }

  if (cached) {
    dropOnvifSession(camera.id);
  }

  const cam = await connectOnvif(camera);
  const profileToken = await ensureProfiles(cam);
  const session: OnvifSession = {
    key,
    cam,
    profileToken,
    lastUsedAt: Date.now(),
    idleTimer: null,
  };
  onvifSessions.set(camera.id, session);
  touchOnvifSession(session, camera.id);
  return session;
}

function continuousMove(
  cam: CamInstance,
  options: { x?: number; y?: number; zoom?: number; profileToken: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    cam.continuousMove(options, (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function stopMove(cam: CamInstance, profileToken: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cam.stop({ panTilt: true, zoom: true, profileToken }, (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** Opens (or reuses) the ONVIF session so the first PTZ click is already warm. */
export async function warmupPtzSession(id: string): Promise<{ ready: true }> {
  const camera = await getCameraById(id);
  if (!camera) {
    throw new Error("Camera nao encontrada.");
  }
  await getOnvifSession(camera);
  return { ready: true };
}

export async function sendPtzCommand(id: string, action: PtzAction, speed = PTZ_SPEED): Promise<void> {
  const camera = await getCameraById(id);
  if (!camera) {
    throw new Error("Camera nao encontrada.");
  }

  let session: OnvifSession;
  try {
    session = await getOnvifSession(camera);
  } catch (error) {
    dropOnvifSession(camera.id);
    throw error;
  }

  const velocity = Math.min(1, Math.max(0.05, speed));

  try {
    if (action === "stop") {
      await stopMove(session.cam, session.profileToken);
      touchOnvifSession(session, camera.id);
      return;
    }

    const moveMap: Record<Exclude<PtzAction, "stop">, { x?: number; y?: number; zoom?: number }> = {
      up: { y: velocity },
      down: { y: -velocity },
      left: { x: -velocity },
      right: { x: velocity },
      zoomIn: { zoom: velocity },
      zoomOut: { zoom: -velocity },
    };

    await continuousMove(session.cam, { ...moveMap[action], profileToken: session.profileToken });
    touchOnvifSession(session, camera.id);
  } catch (error) {
    // Drop stale session so the next command reconnects cleanly.
    dropOnvifSession(camera.id);
    const message = error instanceof Error ? error.message : "Falha no comando PTZ.";
    throw new Error(message);
  }
}
