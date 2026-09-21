import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useGateway } from "@arkosjs/react-websockets";
import { api } from "../../lib/api";
import { useAuth } from "./auth.context";

export type NotificationType =
  | "ChallengeReceived"
  | "ChallengeAccepted"
  | "ChallengeDeclined"
  | "ChampionshipRankDropped"
  | "GlobalRankDropped"
  | "ComeBack"
  | "NewAccount"
  | "ChampionshipStatus";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  inviteId: string | null;
  fromNickname: string | null;
  fromUserId: string | null;
  expiresAt: string | null;
  /** Where a rank alert left the player, which is the whole of what it has to say. */
  rank: number | null;
  /** Places gained since yesterday, for the nudges that carry a movement. */
  move: number | null;
  /** The board `rank` is a place on, for the nudges that are about one. */
  board: "Championship" | "Global" | null;
  outcome: "Accepted" | "Declined" | null;
  readAt: string | null;
  createdAt: string;
}

interface Feed {
  invitations: NotificationRow[];
  activity: NotificationRow[];
  unread: number;
}

interface NotificationsValue extends Feed {
  /** False until the first fetch lands, which is what tells an absent invite apart from an unread feed. */
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: () => Promise<void>;
}

const EMPTY_FEED: Feed = { invitations: [], activity: [], unread: 0 };

export const NotificationsContext = createContext<NotificationsValue | null>(
  null,
);

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value)
    throw new Error("useNotifications must be used inside <NotificationsProvider>");

  return value;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const game = useGateway("/tic-tac-toe");
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: Feed }>("/notifications");
      setFeed(res.data);
    } catch {
      setFeed(EMPTY_FEED);
    } finally {
      setLoaded(true);
    }
  }, []);

  const markRead = useCallback(async () => {
    setFeed((previous) => ({ ...previous, unread: 0 }));
    await api.post("/notifications/read", {});
  }, []);

  useEffect(() => {
    if (!user) {
      setFeed(EMPTY_FEED);
      setLoaded(false);
      return;
    }

    refresh();
  }, [user, refresh]);

  // The server's only job here is to say the feed changed; the row it wrote is the source of truth.
  game.on("notification", refresh);

  return (
    <NotificationsContext.Provider
      value={{ ...feed, loaded, refresh, markRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
