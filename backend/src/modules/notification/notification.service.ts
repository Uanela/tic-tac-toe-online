import { BaseService } from "arkos/services";
import type { NotificationOutcome, NotificationType } from "@prisma/client";

const FEED_LIMIT = 50;

/** The nudges, which a player gets at most one of a day. */
export const ENGAGEMENT_TYPES: NotificationType[] = [
  "ComeBack",
  "NewAccount",
  "ChampionshipStatus",
];

// Lapsed invites count as unanswered: the window closing is not an answer, so they
// stay in Invitations until the receiver accepts or declines.
const UNANSWERED_INVITATION = { type: "ChallengeReceived", outcome: null } as const;

class NotificationService extends BaseService<"notification"> {
  async invitations(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, ...UNANSWERED_INVITATION },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    });
  }

  async activity(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, NOT: UNANSWERED_INVITATION },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
    });
  }

  /** Who has already had their one nudge of the day, so the run can skip them. */
  async engagedToday(userIds: string[], day: Date) {
    if (!userIds.length) return new Set<string>();

    const rows = await this.prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        type: { in: ENGAGEMENT_TYPES },
        createdAt: { gte: day },
      },
      select: { userId: true },
    });

    return new Set(rows.map((row) => row.userId));
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async resolveByInvite(
    userId: string,
    inviteId: string,
    outcome: NotificationOutcome,
  ) {
    await this.prisma.notification.updateMany({
      where: { userId, inviteId, ...UNANSWERED_INVITATION },
      data: { outcome, outcomeAt: new Date() },
    });
  }
}

const notificationService = new NotificationService("notification");

export default notificationService;
