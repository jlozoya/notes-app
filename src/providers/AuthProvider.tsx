import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@demo_user");
        if (raw) setUser(JSON.parse(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, _password: string) => {
    // TODO: call your API here
    const u = { id: "1", email };
    setUser(u);
    await AsyncStorage.setItem("@demo_user", JSON.stringify(u));
  };

  const register = async (email: string, _password: string) => {
    // TODO: call your API here
    const u = { id: "1", email };
    setUser(u);
    await AsyncStorage.setItem("@demo_user", JSON.stringify(u));
  };

  const signOut = async () => {
    setUser(null);
    await AsyncStorage.removeItem("@demo_user");
  };

  const value = useMemo(() => ({ user, loading, signIn, register, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
