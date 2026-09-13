import { z } from "zod";

const SignupSchema = z.object({
  email: z.string().email().toLowerCase().trim().min(1, "email is required"),
  password: z
    .string()
    .min(8, "A palavra-passe deve ter no minímo 8 caractéres")
    .regex(/[a-z]/, "A palavra-passe deve conter ao menos uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter ao menos uma letra maiúscula"),
  player: z.object({
    // Lowercased here as well as in the signup form: requests arrive from
    // anywhere, and a nickname is only ever stored one way.
    nickname: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "O nickname deve ter no mínimo 3 caracteres")
      .max(20, "O nickname deve ter no máximo 20 caracteres")
      .regex(
        /^[a-z0-9_]+$/,
        "O nickname deve conter apenas letras minúsculas, números e underscores (_), sem espaços"
      ),
    apiAction: z.literal("create").default("create"),
  }),
});

export default SignupSchema;

export type SignupSchemaType = z.infer<typeof SignupSchema>;
