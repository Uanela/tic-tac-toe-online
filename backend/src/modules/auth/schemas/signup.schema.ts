import { z } from "zod";

const SignupSchema = z.object({
  email: z.string().email().toLowerCase().trim().min(1, "email is required"),
  password: z
    .string()
    .min(8, "A palavra-passe deve ter no minímo 8 caractéres")
    .regex(/[a-z]/, "A palavra-passe deve conter ao menos uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter ao menos uma letra maiúscula"),
  player: z.object({
    nickname: z
      .string()
      .toLowerCase()
      .trim()
      .min(3)
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Nickname deve apenas conter letras, números e underscores (_)"
      ),
    apiAction: z.literal("create").default("create"),
  }),
});

export default SignupSchema;

export type SignupSchemaType = z.infer<typeof SignupSchema>;
