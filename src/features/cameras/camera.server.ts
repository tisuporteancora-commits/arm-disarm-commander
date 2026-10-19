import "@tanstack/react-start/server-only";

import { promisify } from "node:util";

import {
  createCamera as createCameraRecord,
  deleteCamera as deleteCameraRecord,
  getCameraById,
  listCameras,
  updateCamera as updateCameraRecord,
} from "./camera.store.server";
import type { Camera, CameraInput, CameraPublic, PtzAction } from "./camera.types";

export { getCameraById, listCameras } from "./camera.store.server";

// Loaded on demand so a missing/broken `onvif` install does not crash route loading.
type CamConstructor = typeof import("onvif").Cam;
type CamInstance = InstanceType<CamConstructor>;

const PTZ_SPEED = 0.55;

type OnvifSession = {
  key: string;
  cam: CamInstance;
  profileToken: string;
  lastUsedAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

const onvifSessions = new Map<string, OnvifSession>();
const ONVIF_IDLE_MS = 60_000;

async function loadOnvifCam(): Promise<CamConstructor> {
  try {
    const mod = await import("onvif");
    return mod.Cam;
  } catch (error) {
    const message = error instanceof Error ? error.message : "modulo onvif indisponivel";
    throw new Error(
      `Pacote ONVIF nao carregou (${message}). Na pasta do projeto rode: npm install`,
    );
  }
}

function sessionKey(camera: Camera): string {
  return [camera.id, camera.onvifHost, camera.onvifPort, camera.username, camera.password].join(
    "|",
  );
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

async function connectOnvif(camera: Camera): Promise<CamInstance> {
  const Cam = await loadOnvifCam();
  return new Promise((resolve, reject) => {
    const cam = new Cam(
      {
        hostname: camera.onvifHost,
        username: camera.username,
        password: camera.password,
        port: camera.onvifPort || 9089,
        timeout: 8_000,
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

export async function createCamera(input: CameraInput): Promise<CameraPublic> {
  return createCameraRecord(input);
}

export async function updateCamera(
  id: string,
  input: CameraInput & { password?: string },
): Promise<CameraPublic> {
  const updated = await updateCameraRecord(id, input);
  dropOnvifSession(id);
  return updated;
}

export async function deleteCamera(id: string): Promise<void> {
  await deleteCameraRecord(id);
  dropOnvifSession(id);
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
    dropOnvifSession(camera.id);
    const message = error instanceof Error ? error.message : "Falha no comando PTZ.";
    throw new Error(message);
  }
}
