import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Camera, CameraInput, CameraPublic } from "./camera.types";

const CAMERA_STATE_FILE = join(process.cwd(), ".app-data", "cameras-state.json");
const LEGACY_ALARM_STATE_FILE = join(process.cwd(), ".app-data", "alarm-state.json");

type CameraState = {
  cameras: Camera[];
};

type LegacyAlarmState = {
  cameras?: Camera[];
  [key: string]: unknown;
};

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCameraState(state: CameraState): Promise<void> {
  await mkdir(dirname(CAMERA_STATE_FILE), { recursive: true });
  await writeFile(CAMERA_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

/** Migrates cameras out of the shared alarm-state.json if needed. */
async function readCameraState(): Promise<CameraState> {
  const dedicated = await readJsonFile<CameraState>(CAMERA_STATE_FILE);
  if (dedicated && Array.isArray(dedicated.cameras)) {
    return { cameras: dedicated.cameras };
  }

  const legacy = await readJsonFile<LegacyAlarmState>(LEGACY_ALARM_STATE_FILE);
  const legacyCameras = Array.isArray(legacy?.cameras) ? legacy.cameras : [];

  if (legacyCameras.length > 0) {
    const migrated = { cameras: legacyCameras };
    await writeCameraState(migrated);

    // Remove cameras from the shared alarm file so future alarm writes cannot wipe them.
    if (legacy) {
      const { cameras: _removed, ...rest } = legacy;
      await mkdir(dirname(LEGACY_ALARM_STATE_FILE), { recursive: true });
      await writeFile(
        LEGACY_ALARM_STATE_FILE,
        `${JSON.stringify(rest, null, 2)}\n`,
        "utf-8",
      );
    }

    return migrated;
  }

  return { cameras: [] };
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

export async function listCameras(): Promise<CameraPublic[]> {
  const state = await readCameraState();
  return state.cameras.map(toPublic);
}

export async function getCameraById(id: string): Promise<Camera | undefined> {
  const state = await readCameraState();
  return state.cameras.find((camera) => camera.id === id);
}

export async function createCamera(input: CameraInput): Promise<CameraPublic> {
  const state = await readCameraState();
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

  await writeCameraState({ cameras: [...state.cameras, camera] });
  return toPublic(camera);
}

export async function updateCamera(
  id: string,
  input: CameraInput & { password?: string },
): Promise<CameraPublic> {
  const state = await readCameraState();
  const index = state.cameras.findIndex((camera) => camera.id === id);

  if (index < 0) {
    throw new Error("Camera nao encontrada.");
  }

  const current = state.cameras[index];
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

  const cameras = [...state.cameras];
  cameras[index] = updated;
  await writeCameraState({ cameras });
  return toPublic(updated);
}

export async function deleteCamera(id: string): Promise<void> {
  const state = await readCameraState();
  await writeCameraState({
    cameras: state.cameras.filter((camera) => camera.id !== id),
  });
}
