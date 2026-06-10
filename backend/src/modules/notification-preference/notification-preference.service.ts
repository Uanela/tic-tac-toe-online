import { BaseService } from "arkos/services";
import {
  NotificationPreferenceStatus,
  NotificationPreferenceCategory,
  NotificationPreference,
} from "@prisma/client";
import userService from "../user/user.service";
import { queryOptionsForNotifications } from "../game/utils/start-game-cron";

export class NotificationPreferenceService extends BaseService<"notification-preference"> {
  private allowedDays = {
    [NotificationPreferenceStatus.Never]: [] as number[],
    [NotificationPreferenceStatus.Once]: [3],
    [NotificationPreferenceStatus.Twice]: [2, 5],
    [NotificationPreferenceStatus.Thrice]: [1, 3, 5],
    [NotificationPreferenceStatus.Always]: [0, 1, 2, 3, 4, 5, 6],
  };

  async canNotify(
    preferencesOrUserId:
      | Pick<NotificationPreference, "category" | "status">[]
      | string,
    category: NotificationPreferenceCategory
  ) {
    let preferences: Pick<NotificationPreference, "category" | "status">[] = [];

    if (typeof preferencesOrUserId === "string") {
      const user = await userService.findById(
        preferencesOrUserId,
        queryOptionsForNotifications
      );
      preferences = user?.player?.settings?.notificationPreferences || [];
    }

    if (preferences.every((p) => p.category !== category)) return true;
    const weekDay = new Date().getDay();

    return this.allowedDays[
      preferences.find((p) => p.category === category)?.status || "Always"
    ].includes(weekDay);
  }
}

const notificationPreferenceService = new NotificationPreferenceService(
  "notification-preference"
);

export default notificationPreferenceService;
