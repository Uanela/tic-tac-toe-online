import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setToken, clearToken } from "../../lib/api";

interface User {
  id: string;
  email: string;
  role: string;
}

interface Player {
  id: string;
  nickname: string;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AuthContextValue {
  user: User | null;
  player: Player | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    player: { nickname: string };
  }) => Promise<void>;
  logout: () => void;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await api.get<{ data: User }>("/users/me");
      setUser(res.data);
      await fetchPlayer();
    } catch {
      setUser(null);
      setPlayer(null);
    }
  }

  async function fetchPlayer() {
    try {
      const res = await api.get<{ data: Player }>("/players/me");
      setPlayer(res.data);
    } catch {
      setPlayer(null);
    }
  }

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string }>("/auth/login", {
      email,
      password,
    });
    setToken(res.accessToken);
    await fetchMe();
  }

  async function signup(data: {
    email: string;
    password: string;
    player: { nickname: string };
  }) {
    await api.post("/auth/signup", data);
    await login(data.email, data.password);
  }

  function logout() {
    clearToken();
    setUser(null);
    setPlayer(null);
  }

  async function refreshPlayer() {
    await fetchPlayer();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        player,
        loading,
        login,
        signup,
        logout,
        refreshPlayer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
