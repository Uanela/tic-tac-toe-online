import type React from "react";
import { useMemo } from "react";
import { WebSocketProvider } from "@arkosjs/react-websockets";
import { Manager } from "socket.io-client";
import { useAuth } from "./auth.context";
import { getToken } from "../../lib/api";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:8000";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const token = useMemo(getToken, [user]);

  const manager = useMemo(
    () =>
      new Manager(WS_URL, {
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
