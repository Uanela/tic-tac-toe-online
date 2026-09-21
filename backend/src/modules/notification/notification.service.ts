import { BaseService } from "arkos/services";
import type { NotificationOutcome, NotificationType } from "@prisma/client";

const FEED_LIMIT = 50;

export const ENGAGEMENT_TYPES: NotificationType[] = [
  "ComeBack",
  "NewAccount",
  "ChampionshipStatus",
];

const UNANSWERED_INVITATION = { type: "ChallengeReceived", outcome: null } as const;

class NotificationService extends BaseService<"notification"> {
  async invitations(userId: string) {
    return this.findMany(
      { userId, ...UNANSWERED_INVITATION },
      { orderBy: { createdAt: "desc" }, take: FEED_LIMIT }
    );
  }

  async activity(userId: string) {
    return this.findMany(
      { userId, NOT: UNANSWERED_INVITATION },
      { orderBy: { createdAt: "desc" }, take: FEED_LIMIT }
    );
  }

  async engagedToday(userIds: string[], day: Date) {
    if (!userIds.length) return new Set<string>();

    const rows = await this.findMany(
      {
        userId: { in: userIds },
        type: { in: ENGAGEMENT_TYPES },
        createdAt: { gte: day },
      },
      { select: { userId: true } }
    );

    return new Set(rows.map((row) => row.userId));
  }

  async unreadCount(userId: string) {
    return this.count({ userId, readAt: null });
  }

  async markAllRead(userId: string) {
    await this.updateMany({ userId, readAt: null }, { readAt: new Date() });
  }

  async lapsedInvite(userId: string, inviteId: string) {
    return this.findOne({ userId, inviteId, ...UNANSWERED_INVITATION });
  }

  async resolveByInvite(
    userId: string,
    inviteId: string,
    outcome: NotificationOutcome,
  ) {
    await this.updateMany(
      { userId, inviteId, ...UNANSWERED_INVITATION },
      { outcome, outcomeAt: new Date() }
    );
  }
}

const notificationService = new NotificationService("notification");

export default notificationService;
