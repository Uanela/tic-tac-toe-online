import { z } from "zod";

const ResetPasswordSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .toLowerCase()
    .trim()
    .min(1, "O email é obrigatório"),
  otp: z.string().regex(/^\d{6}$/, "O código deve ter 6 dígitos"),
  newPassword: z
    .string()
    .min(8, "A palavra-passe deve ter no minímo 8 caractéres")
    .regex(/[a-z]/, "A palavra-passe deve conter ao menos uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter ao menos uma letra maiúscula"),
});

export default ResetPasswordSchema;

export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>;
