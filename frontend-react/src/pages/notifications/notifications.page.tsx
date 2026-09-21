import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { Check, Flame, Sparkles, Swords, TrendingDown, X } from "lucide-react";
import { useAuth } from "../../utils/contexts/auth.context";
import { useToast } from "../../utils/contexts/toast.context";
import {
  useNotifications,
  type NotificationRow,
} from "../../utils/contexts/notifications.context";
import { Tabs } from "../../components/tabs";
import { Button } from "../../components/button";
import { Link } from "../../components/link";
import { WaitTimer } from "../play/components/wait-timer";
import { formatNumber, formatRelative } from "../../lib/format";
import useInterval from "../../hooks/use-interval";
import { m } from "../../paraglide/messages.js";
import styles from "./notifications-page.module.css";

type TabId = "invitations" | "activity";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { invitations, activity, markRead } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();
  const game = useGateway("/tic-tac-toe");
  const [tab, setTab] = useState<TabId>("invitations");

  const acceptInviteEmitter = game.useEmit<{ inviteId: string }>(
    "accept_invite",
    { ack: true, timeout: 6000 },
  );
  const declineInviteEmitter = game.useEmit<{ inviteId: string }>(
    "decline_invite",
    { ack: true, timeout: 6000 },
  );

  useEffect(() => {
    if (user) markRead();
  }, [user, markRead]);

  async function accept(row: NotificationRow) {
    if (!row.inviteId) return;

    const result = await acceptInviteEmitter.emit(
      { inviteId: row.inviteId },
      { ack: true },
    );

    if (result?.success) return;

    toast.show({
      variant: "error",
      description: result?.error || m.inbox_accept_failed(),
    });
  }

  async function decline(row: NotificationRow) {
    if (row.inviteId) await declineInviteEmitter.emit({ inviteId: row.inviteId }, { ack: true });
  }

  // The play screen picks this up and sends the challenge, so the countdown and the
  // cancel control live in the one place that already owns them.
  function challengeBack(row: NotificationRow) {
    navigate(`/play?challenge=${row.fromUserId}`);
  }

  if (!user)
    return (
      <div className={styles.gate}>
        <h2>{m.notifications_gate_title()}</h2>
        <p>{m.notifications_gate_sub()}</p>
        <div className={styles.gateCta}>
          <Link to="/auth/login" className="btn">
            {m.nav_login()}
          </Link>
          <Link to="/auth/signup" className="btn ghost">
            {m.nav_signup()}
          </Link>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{m.inbox_title()}</h1>
        <p>{m.inbox_sub()}</p>
      </header>

      <Tabs
        tabs={[
          { id: "invitations", label: m.inbox_tab_invitations() },
          { id: "activity", label: m.inbox_tab_activity() },
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "invitations" && (
        <div className={styles.list}>
          {invitations.length === 0 && (
            <p className={styles.empty}>{m.inbox_empty_invitations()}</p>
          )}

          {invitations.map((row) => (
            <InvitationRow
              key={row.id}
              row={row}
              onAccept={() => accept(row)}
              onDecline={() => decline(row)}
              onChallengeBack={() => challengeBack(row)}
            />
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className={styles.list}>
          {activity.length === 0 && (
            <p className={styles.empty}>{m.inbox_empty_activity()}</p>
          )}

          {activity.map((row) => (
            <div key={row.id} className={styles.row}>
              <span
                className={`${styles.icon} ${styles[activityKind(row)] ?? ""}`}
                aria-hidden="true"
              >
                {activityIcon(row)}
              </span>
              <div className={styles.text}>
                <span className={styles.sentence}>{activitySentence(row)}</span>
                <span className={styles.note}>
                  {formatRelative(row.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationRow({
  row,
  onAccept,
  onDecline,
  onChallengeBack,
}: {
  row: NotificationRow;
  onAccept: () => void;
  onDecline: () => void;
  onChallengeBack: () => void;
}) {
  const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
  const [lapsed, setLapsed] = useState(() => expiresAt <= Date.now());

  useInterval(() => setLapsed(expiresAt <= Date.now()), lapsed ? null : 500);

  // Past its window the challenge cannot start, so the only move left is to send one
  // back. Declining is not one of them: there is nothing left to refuse.
  if (lapsed)
    return (
      <div className={styles.row}>
        <span className={styles.icon} aria-hidden="true">
          <Swords size={15} />
        </span>
        <div className={styles.text}>
          <span className={styles.sentence}>
            {m.inbox_challenged_you({ nickname: row.fromNickname ?? "" })}
          </span>
          <span className={styles.note}>{m.inbox_lapsed()}</span>
        </div>
        {row.fromUserId && (
          <div className={styles.actions}>
            <Button
              className={`btn ${styles.sword}`}
              onClick={onChallengeBack}
              aria-label={m.inbox_challenge_back()}
              title={m.inbox_challenge_back()}
            >
              <Swords size={15} />
              <span className={styles.swordLabel}>
                {m.inbox_challenge_back()}
              </span>
            </Button>
          </div>
        )}
      </div>
    );

  return (
    <div className={styles.row}>
      <span className={`${styles.icon} ${styles.live}`} aria-hidden="true">
        <Swords size={15} />
      </span>
      <div className={styles.text}>
        <span className={styles.sentence}>
          {m.inbox_challenged_you({ nickname: row.fromNickname ?? "" })}
        </span>
        <WaitTimer until={expiresAt} />
      </div>
      <div className={styles.actions}>
        <Button className="btn" onClick={onAccept}>
          {m.invite_accept()}
        </Button>
        <Button className="btn ghost" onClick={onDecline}>
          {m.invite_decline()}
        </Button>
      </div>
    </div>
  );
}

type ActivityKind =
  | "accepted"
  | "declined"
  | "dropped"
  | "nudge"
  | "welcome"
  | "answered";

/** What the row is worth reading as, which the icon and its colour both key off. */
function activityKind(row: NotificationRow): ActivityKind {
  if (row.type === "ChallengeAccepted") return "accepted";
  if (row.type === "ChallengeDeclined") return "declined";
  if (row.type === "NewAccount") return "welcome";
  if (row.type === "ComeBack" || row.type === "ChampionshipStatus") return "nudge";
  if (row.type !== "ChallengeReceived") return "dropped";
  return "answered";
}

function activityIcon(row: NotificationRow) {
  switch (activityKind(row)) {
    case "accepted":
      return <Check size={15} />;
    case "declined":
      return <X size={15} />;
    case "dropped":
      return <TrendingDown size={15} />;
    case "welcome":
      return <Sparkles size={15} />;
    case "nudge":
      return <Flame size={15} />;
    default:
      return <Swords size={15} />;
  }
}

/** " (subiu 2)", left off entirely on a first nudge that has no yesterday. */
function moveSuffix(move: number | null) {
  if (!move) return "";

  return move > 0
    ? m.inbox_moved_up({ move: formatNumber(move) })
    : m.inbox_moved_down({ move: formatNumber(-move) });
}

function activitySentence(row: NotificationRow) {
  const nickname = row.fromNickname ?? "";
  const rank = formatNumber(row.rank ?? 0);
  const board = row.board === "Global" ? "global" : "championship";

  switch (row.type) {
    case "ChallengeAccepted":
      return m.inbox_accepted_yours({ nickname });
    case "ChallengeDeclined":
      return m.inbox_declined_yours({ nickname });
    case "ChampionshipRankDropped":
      return m.inbox_rank_dropped_championship({ rank });
    case "GlobalRankDropped":
      return m.inbox_rank_dropped_global({ rank });
    case "ComeBack":
      return board === "global"
        ? m.inbox_come_back_global({ rank, move: moveSuffix(row.move) })
        : m.inbox_come_back_championship({ rank, move: moveSuffix(row.move) });
    case "NewAccount":
      return m.inbox_new_account();
    case "ChampionshipStatus":
      return m.inbox_championship_status({ rank, move: moveSuffix(row.move) });
    // An answered invite, kept in the feed as history rather than as a second offer.
    default:
      return row.outcome === "Accepted"
        ? m.inbox_you_accepted({ nickname })
        : m.inbox_you_declined({ nickname });
  }
}
