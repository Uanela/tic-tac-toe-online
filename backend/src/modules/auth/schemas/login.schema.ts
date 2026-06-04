import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().toLowerCase().trim(),
  password: z.string(),
});

export default LoginSchema;

export type LoginSchemaType = z.infer<typeof LoginSchema>;
