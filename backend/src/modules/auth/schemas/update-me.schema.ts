import {
  NotificationPreferenceCategory,
  NotificationPreferenceStatus,
} from "@prisma/client";
import { z } from "zod";

const UpdateMeSchema = z.object({
  player: z.object({
    id: z.string().optional(),
    settings: z.object({
      id: z.string(),
      notificationPreferences: z.array(
        z.object({
          id: z.string().optional(),
          category: z.nativeEnum(NotificationPreferenceCategory),
          status: z.nativeEnum(NotificationPreferenceStatus),
        })
      ),
    }),
  }),
});

export default UpdateMeSchema;

export type UpdateMeSchemaType = z.infer<typeof UpdateMeSchema>;
