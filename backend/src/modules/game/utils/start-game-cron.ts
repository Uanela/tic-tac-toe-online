import cron from "node-cron";
import userService from "../../user/user.service";
import {
  EmailTemplateResult,
  eveningInviteEmail,
  lunchInviteEmail,
  morningInviteEmail,
} from "./email-templates/invintations.email";
import { emailService } from "arkos/services";

function sendEmails(
  users: { email: string; player: { nickname: string } | null }[],
  templateFn: (player: { nickname: string }) => EmailTemplateResult
) {
  users.forEach((user) => {
    if (!user.player) return;

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
    const users = await userService.findMany(
      {},
      { select: { email: true, player: { select: { nickname: true } } } }
    );

    switch (time) {
      case "9":
        sendEmails(users, morningInviteEmail);
        break;
      case "12":
        sendEmails(users, lunchInviteEmail);
        break;
      case "20":
        sendEmails(users, eveningInviteEmail);
        break;
    }
  };
}

export default function startGameCron() {
  cron.schedule("15 9 * * *", scheduleByTime("9"));
  cron.schedule("30 12 * * *", scheduleByTime("12"));
  cron.schedule("0 20 * * *", scheduleByTime("20"));
}
