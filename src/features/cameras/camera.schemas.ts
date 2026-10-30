import { z } from "zod";

export const cameraInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da camera."),
  rtspUrl: z
    .string()
    .trim()
    .regex(/^rtsps?:\/\/.+/i, "Informe uma URL RTSP valida (rtsp://...)."),
  onvifHost: z.string().trim().optional().or(z.literal("")),
  onvifPort: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().trim().min(1, "Informe o usuario da camera."),
  password: z.string().min(1, "Informe a senha da camera."),
});

export const cameraUpdateSchema = cameraInputSchema
  .extend({
    id: z.string().min(1),
    password: z.string().optional().or(z.literal("")),
  })
  .superRefine((input, ctx) => {
    // Password optional on update means "keep current".
    if (input.password === undefined) return;
  });

export const cameraIdSchema = z.object({
  id: z.string().min(1, "Informe o ID da camera."),
});

export const ptzActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["up", "down", "left", "right", "zoomIn", "zoomOut", "stop"]),
  speed: z.number().min(0.05).max(1).optional(),
});

export const gotoPresetSchema = z.object({
  id: z.string().min(1),
  // Intelbras/ONVIF may return numeric tokens; coerce to string for SOAP.
  presetToken: z.coerce.string().trim().min(1, "Informe o preset."),
});
