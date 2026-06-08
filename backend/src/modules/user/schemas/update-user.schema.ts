import { z } from "zod";
import apiActions from "@/src/utils/validation/api-actions";

const UpdateUserSchema = z.object({
  email: z.string().optional(),
  isSuperUser: z.boolean().optional(),
  isStaff: z.boolean().optional(),
  isActive: z.boolean().optional(),
  role: z.string().optional(),
  password: z
    .string()
    .min(8, "A palavra-passe deve ter no minímo 8 caractéres")
    .regex(/[a-z]/, "A palavra-passe deve conter ao menos uma letra minúscula")
    .regex(/[A-Z]/, "A palavra-passe deve conter ao menos uma letra maiúscula"),
});

export default UpdateUserSchema;

export type UpdateUserSchemaType = z.infer<typeof UpdateUserSchema>;
