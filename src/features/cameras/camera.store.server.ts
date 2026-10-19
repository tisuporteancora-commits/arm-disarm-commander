import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Camera, CameraInput, CameraPublic } from "./camera.types";

const STATE_FILE = join(process.cwd(), ".app-data", "alarm-state.json");

type StoredState = {
  cameras?: Camera[];
  [key: string]: unknown;
};

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
  return toPublic(updated);
}

export async function deleteCamera(id: string): Promise<void> {
  const state = await readStoredState();
  const cameras = (state.cameras ?? []).filter((camera) => camera.id !== id);
  await writeStoredState({ ...state, cameras });
}
