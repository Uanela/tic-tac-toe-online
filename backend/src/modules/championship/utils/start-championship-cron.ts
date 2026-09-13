import cron from "node-cron";
import { emailService } from "arkos/services";
import championshipService, {
  ChampionshipBounds,
  WINNER_COUNT,
} from "../championship.service";
import notificationPreferenceService from "../../notification-preference/notification-preference.service";
import {
  championshipRecapEmail,
  championshipWinnerEmail,
} from "./email-templates/championship.email";

const MAPUTO = "Africa/Maputo";

/**
 * Writes the close-out for `period`. The four champions are picked from everyone
 * who played, bots included, so a bot in the top four still shows up in the list
 * as the rank it actually holds. The messages themselves only go to humans: the
 * four get their own, everyone else gets the recap that names them.
 */
async function sendCloseOut(period: ChampionshipBounds, at: Date) {
  const standings = await championshipService.participants(period);
  const champions = standings.slice(0, WINNER_COUNT);

  const recipients = await championshipService.recipients(period);

  const sends = recipients.map(async (recipient) => {
    const allowed = await notificationPreferenceService.canNotify(
      recipient.userId,
      "Annoucements"
    );
    if (!allowed) return false;

    const rank = standings.findIndex((row) => row.playerId === recipient.playerId);

    const template =
      rank < WINNER_COUNT
        ? championshipWinnerEmail(recipient, period, rank + 1, champions)
        : championshipRecapEmail(recipient, period, champions);

    await emailService.send({ to: recipient.email, ...template });

    return true;
  });

  const settled = await Promise.allSettled(sends);

  for (const result of settled) {
    if (result.status === "rejected")
      console.error("[championship] close-out email failed", result.reason);
  }

  console.log(
    `[championship] closed the week ending ${period.endedAt.toISOString()} for ${champions.length} champion(s) at ${at.toISOString()}`
  );

  return settled.filter(
    (result) => result.status === "fulfilled" && result.value
  ).length;
}

/**
 * Closes the week that just ended, unless it is already closed. Running twice is
 * harmless — the period marker decides which run actually sends, which is what
 * keeps a restart on the boundary from mailing everyone a second time.
 */
export async function closeWeek(at: Date = new Date()) {
  const period = championshipService.pendingClose(at);

  if (!(await championshipService.beginClose(period))) return 0;

  try {
    const sent = await sendCloseOut(period, at);
    await championshipService.finishClose(period);

    return sent;
  } catch (error) {
    // Left unmarked on purpose: the next boot picks the week up again rather than
    // dropping it. Only a failure before any send gets here, so nothing repeats.
    console.error("[championship] close-out failed, retrying on next boot", error);

    return 0;
  }
}

export default function startChampionshipCron() {
  const run = () =>
    closeWeek().catch((error) =>
      console.error("[championship] close-out check failed", error)
    );

  cron.schedule("0 0 * * 1", run, { timezone: MAPUTO });

  // The server is not always awake at midnight on Monday, so the boot itself is
  // the second chance to close a week that ended while it was down.
  run();
}
