import type React from "react";
import { useEffect } from "react";
import { useGateway } from "@arkosjs/react-websockets";
import { useNavigate } from "react-router-dom";
import { Navbar } from "./navbar";
import { RichText } from "./rich-text";
import { useToast } from "../utils/contexts/toast.context";
import { useAuth } from "../utils/contexts/auth.context";
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
  const game = useGateway("/tic-tac-toe");
  const { play } = useSound();
  const toast = useToast();

  useEffect(() => {
    if (!user) {
      return;
    }
    try {
      game.raw.rawSocket.connect();
    } catch (err) {
      console.log(err);
    }
  }, [user]);

  const declineInviteEmitter = game.useEmit<{ inviteId: string; }>(
    "decline_invite",
    { ack: true, timeout: 6000 }
  );

  function handleAcceptInvite(inviteId: string) {
    toast.dismiss(inviteKey(inviteId));
    navigate(`/play?inviteId=${inviteId}`);
  }

  function handleDeclineInvite(inviteId: string) {
    declineInviteEmitter.emit({ inviteId }, { ack: true });
    toast.dismiss(inviteKey(inviteId));
  }

  game.on<InviteReceivedData>("invite_received", (data) => {
    play("dimmed");
    toast.show({
      key: inviteKey(data.inviteId),
      variant: "invite",
      title: m.invite_title(),
      description: (
        <RichText parts={ m.invite_body.parts({ nickname: data.fromNickname }) } />
      ),
      expiresAt: data.expiresAt,
      duration: 0,
      actions: [
        {
          label: m.invite_accept(),
          onClick: () => handleAcceptInvite(data.inviteId),
        },
        {
          label: m.invite_decline(),
          emphasis: "ghost",
          onClick: () => handleDeclineInvite(data.inviteId),
        },
      ],
    });
  });

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
    navigate(`/play?gameScreen=game&gameState=${JSON.stringify(data)}`);
  });

  return (
    <>
      <Navbar />
      { children }
    </>
  );
}

function inviteKey(inviteId: string) {
  return `invite:${inviteId}`;
}
