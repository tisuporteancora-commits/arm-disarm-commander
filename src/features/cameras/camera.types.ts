export type Camera = {
  id: string;
  name: string;
  rtspUrl: string;
  onvifHost: string;
  onvifPort: number;
  username: string;
  password: string;
  createdAt: string;
};

export type CameraInput = {
  name: string;
  rtspUrl: string;
  onvifHost?: string;
  onvifPort?: number;
  username: string;
  password: string;
};

export type CameraPublic = Omit<Camera, "password"> & {
  hasPassword: boolean;
};

export type PtzAction = "up" | "down" | "left" | "right" | "zoomIn" | "zoomOut" | "stop";

export type CameraPreset = {
  token: string;
  name: string;
};
