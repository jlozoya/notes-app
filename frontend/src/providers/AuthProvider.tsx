import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";

type User = { id: string; email: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
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
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
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
      throw new Error("Network error. Is the server reachable?");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("@auth_user");
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); }
          catch {
            await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
            setUser(null);
          }
        }
      } catch {
        Toast.show({
          type: "error",
          text1: "Session error",
          text2: "Failed to read saved session.",
          position: "bottom",
          visibilityTime: 4000,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const register = async (email: string, password: string) => {
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string } }>(
        `${API_URL}/api/auth/signup`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }
      ).catch((error) => {
        Toast.show({
          type: "error",
          text1: "Signup failed",
          text2: error.message,
          position: "bottom",
          visibilityTime: 4000,
        });
      });
      if (!data) {
        return;
      };
      await AsyncStorage.setItem("@auth_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("@auth_token", data.token);
      setUser(data.user);
      router.replace("/(app)/notes");
      Toast.show({
        type: "success",
        text1: "Account created",
        text2: `Welcome ${data.user.email}`,
        position: "bottom",
        visibilityTime: 4000,
      });
    } catch (error: any) {
      const message = error?.message || "Signup failed";
      Toast.show({
        type: "error",
        text1: "Signup failed",
        text2: message,
        position: "bottom",
        visibilityTime: 4000,
      });
      throw new Error(message);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string } }>(
        `${API_URL}/api/auth/login`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }
      ).catch((error) => {
        Toast.show({
          type: "error",
          text1: "Login failed",
          text2: error.message,
          position: "bottom",
          visibilityTime: 4000,
        });
      });
      if (!data) {
        return;
      };
      await AsyncStorage.setItem("@auth_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("@auth_token", data.token);
      setUser(data.user);
      Toast.show({
        type: "success",
        text1: "Logged in",
        text2: `Hello ${data.user.email}`,
        position: "bottom",
        visibilityTime: 4000,
      });
    } catch (err: any) {
      const message = err?.message || "Invalid credentials";
      Toast.show({
        type: "error",
        text1: "Login failed",
        text2: message,
        position: "bottom",
        visibilityTime: 4000,
      });
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
      setUser(null);
      Toast.show({
        type: "info",
        text1: "Signed out",
        position: "bottom",
        visibilityTime: 4000,
      });
    } catch {
      setUser(null);
      Toast.show({
        type: "error",
        text1: "Sign out issue",
        text2: "Could not fully clear session.",
        position: "bottom",
        visibilityTime: 4000,
      });
    }
  };

  const value = useMemo(
    () => ({ user, loading, signIn, register, signOut }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
