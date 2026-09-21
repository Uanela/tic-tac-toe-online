import type React from "react";
import { useEffect, useRef } from "react";
import { useGateway } from "@arkosjs/react-websockets";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "./navbar";
import { PushPrompt } from "./push-prompt";
import { RichText } from "./rich-text";
import pushService from "../lib/push";
import { useToast } from "../utils/contexts/toast.context";
import { useAuth } from "../utils/contexts/auth.context";
import { useNotifications } from "../utils/contexts/notifications.context";
import { useSound } from "../utils/contexts/sound.context";
import { m } from "../paraglide/messages.js";
import type { GameServerState } from '../pages/play/play.page';

interface InviteReceivedData {
  inviteId: string;
  fromNickname: string;
  fromUserId: string;
  expiresAt: number;
}

interface InviteDeclinedData {
  byNickname: string;
}

interface InviteExpiredData {
  inviteId?: string;
  message: string;
}

export function Layout({ children }: { children: React.ReactNode; }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { invitations, loaded: feedLoaded } = useNotifications();
  const game = useGateway("/tic-tac-toe");
  const { play } = useSound();
  const toast = useToast();
  const offerKeys = useRef<string[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    try {
      game.raw.rawSocket.connect();
    } catch (err) {
      console.log(err);
    }
    // A previously granted browser still has to hand the server its installation, which
    // also covers one that was reset since (the FID rotates).
    pushService.sync().catch((err) => console.log(err));
  }, [user]);

  const declineInviteEmitter = game.useEmit<{ inviteId: string; }>(
    "decline_invite",
    { ack: true, timeout: 6000 }
  );

  // `accept=1` is the player having answered in the toast, which is what tells the play
  // screen to join straight away instead of putting the challenge to them a second time.
  function handleAcceptInvite(inviteId: string) {
    toast.dismiss(inviteKey(inviteId));
    navigate(`/play?inviteId=${inviteId}&accept=1`);
  }

  function handleDeclineInvite(inviteId: string) {
    declineInviteEmitter.emit({ inviteId }, { ack: true });
    toast.dismiss(inviteKey(inviteId));
  }

  /** The question a challenge asks, which is the same one whether the socket brought
   *  it or a push opened the app on it. */
  function offerInvite(invite: {
    inviteId: string;
    nickname: string;
    expiresAt: number;
  }) {
    offerKeys.current = [
      ...offerKeys.current.filter((key) => key !== inviteKey(invite.inviteId)),
      inviteKey(invite.inviteId),
    ];

    toast.show({
      key: inviteKey(invite.inviteId),
      variant: "invite",
      title: m.invite_title(),
      description: (
        <RichText parts={ m.invite_body.parts({ nickname: invite.nickname }) } />
      ),
      expiresAt: invite.expiresAt,
      duration: 0,
      actions: [
        {
          label: m.invite_accept(),
          onClick: () => handleAcceptInvite(invite.inviteId),
        },
        {
          label: m.invite_decline(),
          emphasis: "ghost",
          onClick: () => handleDeclineInvite(invite.inviteId),
        },
      ],
    });
  }

  game.on<InviteReceivedData>("invite_received", (data) => {
    play("dimmed");
    offerInvite({
      inviteId: data.inviteId,
      nickname: data.fromNickname,
      expiresAt: data.expiresAt,
    });
  });

  // A push can only open the app; it cannot answer for the player. The challenge it
  // carries is raised as the same offer, so the question is asked in one place and
  // answered the same way whether the app was already open or not.
  useEffect(() => {
    const inviteId = searchParams.get("inviteId");

    if (!inviteId || !feedLoaded || searchParams.get("accept") === "1") return;

    const row = invitations.find((invitation) => invitation.inviteId === inviteId);
    const expiresAt = row?.expiresAt ? new Date(row.expiresAt).getTime() : 0;

    // The offer has taken it over, which is why the parameter does not outlive it.
    setSearchParams(
      (params) => {
        params.delete("inviteId");
        return params;
      },
      { replace: true },
    );

    if (row && expiresAt > Date.now()) {
      offerInvite({
        inviteId,
        nickname: row.fromNickname ?? "",
        expiresAt,
      });
      return;
    }

    // Past its window there is nothing left to answer, only the way back.
    const fromUserId = row?.fromUserId;

    toast.show({
      variant: "info",
      description: m.inbox_lapsed(),
      actions: fromUserId
        ? [
            {
              label: m.inbox_challenge_back(),
              onClick: () => navigate(`/play?challenge=${fromUserId}`),
            },
          ]
        : undefined,
    });
  }, [searchParams, feedLoaded, invitations]);

  game.on<InviteDeclinedData>("invite_declined", (data) => {
    toast.show({
      variant: "info",
      title: m.toast_invite_declined_title(),
      description: (
        <RichText parts={ m.toast_invite_declined.parts({ nickname: data.byNickname }) } />
      ),
    });
  });

  // Also how a cancelled invite arrives, which is why the pending toast is keyed.
  game.on<InviteExpiredData>("invite_expired", (data) => {
    if (data.inviteId) toast.dismiss(inviteKey(data.inviteId));
    toast.show({ variant: "info", description: data.message });
  });

  game.on<{ message?: string }>("waiting_timeout", (data) => {
    toast.show({
      variant: "error",
      description: data?.message || m.toast_no_opponent(),
    });
  });

  game.on<GameServerState>("game_state", (data) => {
    // A match starting uses up every open offer, including one answered from the notifications tab.
    offerKeys.current.forEach(toast.dismiss);
    offerKeys.current = [];
    navigate(`/play?gameScreen=game&gameState=${JSON.stringify(data)}`);
  });

  return (
    <>
      <Navbar />
      { user && <PushPrompt /> }
      { children }
    </>
  );
}

function inviteKey(inviteId: string) {
  return `invite:${inviteId}`;
}
