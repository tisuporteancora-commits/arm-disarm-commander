import { z } from "zod";

export const companySchema = z.object({
  id: z.string().trim().min(1, "Informe o ID da empresa."),
  name: z.string().trim().min(1, "Informe o nome da empresa."),
});

export const alarmSettingsSchema = z.object({
  targetHost: z.string().trim().min(1, "Informe o IP ou host."),
  targetPort: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "Informe uma porta valida."),
  companies: z.array(companySchema).min(1, "Cadastre ao menos uma empresa."),
});

export const alarmCommandSchema = z.object({
  operator: z.string().trim().min(2, "Informe o nome do operador."),
  client: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "A conta deve ter exatamente 4 digitos."),
  organization: z.string().trim().min(1, "Selecione a empresa."),
  command: z.enum(["ARMAR", "DESARMAR"]),
});
