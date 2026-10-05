import { z } from "zod";

export const companySchema = z.object({
  id: z.string().trim().min(1, "Informe o ID da empresa."),
  name: z.string().trim().min(1, "Informe o nome da empresa."),
});

export const temSettingsSchema = z.object({
  baseUrl: z.string().trim(),
  apiKey: z.string().trim(),
  defaultPin: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "O PIN padrao deve ter 4 digitos.")
    .default(""),
});

export const alarmSettingsSchema = z.object({
  targetHost: z.string().trim().min(1, "Informe o IP ou host."),
  targetPort: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "Informe uma porta valida."),
  tem: temSettingsSchema.optional(),
  companies: z.array(companySchema).min(1, "Cadastre ao menos uma empresa."),
});

export const temScheduleSchema = z.object({
  operator: z.string().trim().min(2, "Informe o nome do operador."),
  account: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,16}$/, "Informe a conta da central (ate 16 letras ou numeros)."),
  command: z.enum(["ARMAR", "DESARMAR"]),
  datetime: z
    .string()
    .min(1, "Selecione data e hora.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data e hora invalidas."),
});

export const temCommandSchema = z
  .object({
    operator: z.string().trim().min(2, "Informe o nome do operador."),
    account: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,16}$/, "Informe a conta da central (ate 16 letras ou numeros)."),
    command: z.enum(["ARMAR", "DESARMAR", "ISOLAR", "DESISOLAR"]),
    pin: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "O PIN deve ter 4 digitos.")
      .optional()
      .or(z.literal("")),
    zones: z
      .array(z.number().int().min(1, "Setor invalido.").max(999, "Setor invalido."))
      .max(64, "Informe no maximo 64 setores.")
      .optional(),
  })
  .superRefine((input, ctx) => {
    const needsZones = input.command === "ISOLAR" || input.command === "DESISOLAR";
    if (needsZones && (!input.zones || input.zones.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["zones"],
        message: "Informe ao menos um setor.",
      });
    }
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
