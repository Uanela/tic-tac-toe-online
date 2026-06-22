import type React from "react";
import { useState, useEffect, useMemo } from "react";
import { useGateway } from "@arkosjs/react-websockets";
import { useNavigate } from "react-router-dom";
import { Navbar } from "./navbar";
import { InviteModal } from "./invite-modal";
import { Toast } from "./toast";
import { useAuth } from "../utils/contexts/auth.context";
import { Howl } from "howler";

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
  message: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const game = useGateway("/tic-tac-toe");
  var gameStartSound = useMemo(
    () =>
      new Howl({
        src: ["/sounds/sfx/game-start.mp3"],
      }),
    []
  );

  const [pendingInvite, setPendingInvite] = useState<InviteReceivedData | null>(
    null
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(null);
    setTimeout(() => setToast(msg), 10);
  };

  // ── keep socket alive for the entire session ──────────────────────────────
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

  game.on<InviteReceivedData>("invite_received", (data) => {
    gameStartSound.play();
    setPendingInvite(data);
  });

  game.on<InviteDeclinedData>("invite_declined", (data) => {
    showToast(`${data.byNickname} declined your challenge`);
  });

  game.on<InviteExpiredData>("invite_expired", (data) => {
    setPendingInvite(null);
    showToast(data.message);
  });

  game.on("waiting_timeout", () => {
    showToast("No opponent found. Try again!");
  });

  async function handleAcceptInvite() {
    if (!pendingInvite) return;
    const inviteId = pendingInvite.inviteId;
    setPendingInvite(null);
    navigate(`/play?inviteId=${inviteId}`);
  }

  const declineInviteEmitter = game.useEmit<{ inviteId: string }>(
    "decline_invite",
    { ack: true, timeout: 6000 }
  );

  function handleDeclineInvite() {
    if (!pendingInvite) return;
    declineInviteEmitter.emit(
      { inviteId: pendingInvite.inviteId },
      { ack: true }
    );
    setPendingInvite(null);
  }
  return (
    <>
      <Navbar />
      {children}

      {pendingInvite && (
        <InviteModal
          fromNickname={pendingInvite.fromNickname}
          expiresAt={pendingInvite.expiresAt}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
