import type React from "react";
import { useMemo } from "react";
import { WebSocketProvider } from "@arkosjs/react-websockets";
import { Manager } from "socket.io-client";
import { useAuth } from "./auth.context";
import { BASE, getToken } from "../../lib/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const token = useMemo(getToken, [user]);

  const manager = useMemo(
    () =>
      new Manager(BASE, {
        autoConnect: true,
        reconnection: true,
        transports: ["websocket"],
        withCredentials: true,
      }),
    [user]
  );

  return (
    <WebSocketProvider manager={manager} options={{ auth: { token } }}>
      {children}{" "}
    </WebSocketProvider>
  );
}
