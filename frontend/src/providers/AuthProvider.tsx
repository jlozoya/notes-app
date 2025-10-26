import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  authError: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000";

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // If body isn't JSON, keep data as null
    }

    if (!res.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Request failed (${res.status})`;
      const err = new Error(message) as Error & { status?: number; details?: any };
      err.status = res.status;
      err.details = data;
      throw err;
    }

    return data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection.");
    }
    if (err?.message?.includes("Network request failed")) {
      throw new Error("Network error. Are you online and is the server reachable?");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearError = () => setAuthError(null);

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("@auth_user");
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
            setUser(null);
          }
        }
      } catch (e) {
        setAuthError("Failed to load session from storage.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const register = async (email: string, password: string) => {
    clearError();
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string } }>(
        `${API_URL}/api/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      await AsyncStorage.setItem("@auth_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("@auth_token", data.token);
      setUser(data.user);
    } catch (err: any) {
      const message = err?.message || "Signup failed";
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signIn = async (email: string, password: string) => {
    clearError();
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string } }>(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      await AsyncStorage.setItem("@auth_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("@auth_token", data.token);
      setUser(data.user);
    } catch (err: any) {
      const message = err?.message || "Invalid credentials";
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signOut = async () => {
    clearError();
    try {
      await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
      setUser(null);
    } catch {
      setUser(null);
      setAuthError("Could not fully clear session from storage.");
    }
  };

  const value = useMemo(
    () => ({ user, loading, authError, clearError, signIn, register, signOut }),
    [user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
