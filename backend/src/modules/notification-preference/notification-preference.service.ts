import { BaseService } from "arkos/services";
import {
  NotificationPreferenceStatus,
  NotificationPreferenceCategory,
  NotificationPreference,
} from "@prisma/client";

export class NotificationPreferenceService extends BaseService<"notification-preference"> {
  private allowedDays = {
    [NotificationPreferenceStatus.Never]: [] as number[],
    [NotificationPreferenceStatus.Once]: [3],
    [NotificationPreferenceStatus.Twice]: [2, 5],
    [NotificationPreferenceStatus.Thrice]: [1, 3, 5],
    [NotificationPreferenceStatus.Always]: new Array(7) as number[],
  };

  canNotify(
    preferences: Pick<NotificationPreference, "category" | "status">[] = [],
    category: NotificationPreferenceCategory
  ) {
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
