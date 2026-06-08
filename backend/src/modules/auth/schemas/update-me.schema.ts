import { z } from "zod";

const UpdateMeSchema = z.object({
  password: z
    .string()
    .min(8, "A palavra-passe deve ter no minímo 8 caractéres")
    .regex(/[a-z]/, "A palavra-passe deve conter ao menos uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter ao menos uma letra maiúscula"),
});

export default UpdateMeSchema;

export type UpdateMeSchemaType = z.infer<typeof UpdateMeSchema>;
