import { ArkosRouter, RouteHook } from "arkos";
import { z } from "zod";
import notificationController from "./notification.controller";

// A notification is only ever read by the player it belongs to, and created by the
// challenge flow. The generated CRUD would expose every player's feed.
export const hook: RouteHook = {
  findMany: { disabled: true },
  findOne: { disabled: true },
  createOne: { disabled: true },
  updateOne: { disabled: true },
  deleteOne: { disabled: true },
};

const deviceSchema = z.object({
  installationId: z.string().min(1),
  status: z.enum(["Granted", "Denied"]).optional(),
});

const notificationRouter = ArkosRouter({
  prefix: "/notifications",
  openapi: { tags: ["Notifications"] },
});

notificationRouter.get(
  { path: "/", authentication: true },
  notificationController.getFeed,
);

notificationRouter.post(
  { path: "/read", authentication: true },
  notificationController.markRead,
);

notificationRouter.post(
  {
    path: "/devices",
    authentication: true,
    validation: { body: deviceSchema },
  },
  notificationController.registerDevice,
);

notificationRouter.delete(
  {
    path: "/devices",
    authentication: true,
    validation: { body: deviceSchema },
  },
  notificationController.removeDevice,
);

export default notificationRouter;
