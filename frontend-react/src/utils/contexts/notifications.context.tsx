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
  rank: number | null;
  move: number | null;
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

  game.on("notification", refresh);

  return (
    <NotificationsContext.Provider
      value={{ ...feed, loaded, refresh, markRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
