import { z } from "zod";

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .toLowerCase()
    .trim()
    .min(1, "O email é obrigatório"),
});

export default ForgotPasswordSchema;

export type ForgotPasswordSchemaType = z.infer<typeof ForgotPasswordSchema>;
