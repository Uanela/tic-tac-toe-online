import type React from "react";
import { useEffect, useMemo } from "react";
import { WebSocketProvider } from "@arkosjs/react-websockets";
import { Manager } from "socket.io-client";
import { useAuth } from "./auth.context";
import { BASE, getToken } from "../../lib/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { player } = useAuth();
  const token = useMemo(getToken, [player]);

  const manager = useMemo(
    () =>
      new Manager(BASE, {
        autoConnect: true,
        reconnection: true,
        transports: ["websocket"],
        withCredentials: true,
        path: "/api/socket.io",
      }),
    [player]
  );

  const socket = useMemo(() => {
    if (manager && player) return manager.socket("/tic-tac-toe");
  }, [manager, player]);

  useEffect(() => {
    if (!socket) return;
    socket.connect();
    console.log(socket.connected);
    socket.on("game_state", () => {
      console.log("one");
    });

    socket.on("game_state", () => {
      console.log("two");
    });
  }, [socket]);

  return (
    <WebSocketProvider manager={manager} options={{ auth: { token } }}>
      {children}{" "}
    </WebSocketProvider>
  );
}
