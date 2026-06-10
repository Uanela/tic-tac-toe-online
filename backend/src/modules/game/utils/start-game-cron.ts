import cron from "node-cron";
import userService from "../../user/user.service";
import {
  EmailTemplateResult,
  eveningInviteEmail,
  lunchInviteEmail,
  morningInviteEmail,
} from "./email-templates/invintations.email";
import { emailService } from "arkos/services";
import { NotificationPreferenceCategory, Prisma } from "@prisma/client";
import notificationPreferenceService from "../../notification-preference/notification-preference.service";

const queryOptions = {
  select: {
    email: true,
    player: {
      select: {
        nickname: true,
        settings: {
          select: {
            notificationPreferences: {
              select: {
                category: true,
                status: true,
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserFindManyArgs;

function sendEmails(
  users: Prisma.UserGetPayload<typeof queryOptions>[],
  templateFn: (player: { nickname: string }) => EmailTemplateResult,
  category: NotificationPreferenceCategory
) {
  users.forEach((user) => {
    if (
      !user?.player ||
      !notificationPreferenceService.canNotify(
        user.player.settings?.notificationPreferences,
        category
      )
    )
      return;

    emailService
      .send({
        to: user.email,
        ...templateFn(user.player),
      })
      .catch(console.error);
  });
}

function scheduleByTime(time: "9" | "12" | "20") {
  return async () => {
    const users = await userService.findMany({}, queryOptions);

    switch (time) {
      case "9":
        sendEmails(users, morningInviteEmail, "MorningDailyRemainder");
        break;
      case "12":
        sendEmails(users, lunchInviteEmail, "AfternoonDailyRemainder");
        break;
      case "20":
        sendEmails(users, eveningInviteEmail, "NightDailyRemainder");
        break;
    }
  };
}

export default function startGameCron() {
  cron.schedule("15 9 * * *", scheduleByTime("9"));
  cron.schedule("30 12 * * *", scheduleByTime("12"));
  cron.schedule("0 20 * * *", scheduleByTime("20"));
}
