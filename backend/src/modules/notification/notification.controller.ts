import { BaseController } from "arkos/controllers";
import { ArkosRequest, ArkosResponse } from "arkos";
import notificationService from "./notification.service";
import pushInstallationService from "../push-installation/push-installation.service";

class NotificationController extends BaseController {
  async getFeed(req: ArkosRequest, res: ArkosResponse) {
    const userId = req.user!.id;

    const [invitations, activity, unread] = await Promise.all([
      notificationService.invitations(userId),
      notificationService.activity(userId),
      notificationService.unreadCount(userId),
    ]);

    res.status(200).json({
      status: "success",
      data: { invitations, activity, unread },
    });
  }

  async markRead(req: ArkosRequest, res: ArkosResponse) {
    await notificationService.markAllRead(req.user!.id);
    res.status(200).json({ status: "success" });
  }

  async registerDevice(req: ArkosRequest, res: ArkosResponse) {
    const { installationId, status } = req.body;

    if (status === "Denied")
      await pushInstallationService.deny(req.user!.id, installationId);
    else await pushInstallationService.register(req.user!.id, installationId);

    res.status(200).json({ status: "success" });
  }

  async removeDevice(req: ArkosRequest, res: ArkosResponse) {
    await pushInstallationService.remove(req.user!.id, req.body.installationId);
    res.status(200).json({ status: "success" });
  }
}

const notificationController = new NotificationController("notification");

export default notificationController;
