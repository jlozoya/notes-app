import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";

type User = { id: string; email: string; emailVerified?: boolean } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (id: string, token: string, password: string) => Promise<void>;
  setSession: (token: string, user: { id: string; email: string }) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    if (err?.name === "AbortError") throw new Error("Request timed out. Please check your connection.");
    if (err?.message?.includes("Network request failed")) throw new Error("Network error. Is the server reachable?");
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken] = await AsyncStorage.multiGet(["@auth_user", "@auth_token"]);
        const userStr = storedUser?.[1];
        const tokenStr = storedToken?.[1];
        if (userStr && tokenStr) {
          try { setUser(JSON.parse(userStr)); } catch {
            await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
            setUser(null);
          }
          setToken(tokenStr || null);
        }
      } catch {
        Toast.show({ type: "error", text1: "Session error", text2: "Failed to read saved session.", position: "bottom", visibilityTime: 4000 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setSession = async (newToken: string, usr: { id: string; email: string }) => {
    await AsyncStorage.setItem("@auth_user", JSON.stringify(usr));
    await AsyncStorage.setItem("@auth_token", newToken);
    setUser(usr);
    setToken(newToken);
    Toast.show({ type: "success", text1: "Session set", text2: `Welcome ${usr.email}`, position: "bottom", visibilityTime: 3000 });
  };

  const fetchAuthJson = async <T,>(path: string, init: RequestInit = {}) => {
    if (!token) throw new Error("Not authenticated");
    try {
      return await fetchJson<T>(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err: any) {
      if (err?.status === 401) {
        await signOut();
        Toast.show({ type: "error", text1: "Session expired. Please log in again." });
      }
      throw err;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string } }>(
        `${API_URL}/api/auth/signup`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }
      ).catch((error) => {
        Toast.show({ type: "error", text1: "Signup failed", text2: error.message, position: "bottom", visibilityTime: 4000 });
      });
      if (!data) return;
      await setSession(data.token, data.user);
      router.replace("/(auth)/login");
      Toast.show({ type: "success", text1: "Check your email", text2: "We sent a verification link. Verify to continue.", position: "bottom", visibilityTime: 4500 });
    } catch (error: any) {
      const message = error?.message || "Signup failed";
      Toast.show({ type: "error", text1: "Signup failed", text2: message, position: "bottom", visibilityTime: 4000 });
      throw new Error(message);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await fetchJson<{ token: string; user: { id: string; email: string; emailVerified: boolean } }>(
        `${API_URL}/api/auth/login`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }
      ).catch((error) => {
        Toast.show({ type: "error", text1: "Login failed", text2: error.message, position: "bottom", visibilityTime: 4000 });
        if (error.message === "Please verify your email before logging in") {
          const e = encodeURIComponent(email.trim().toLowerCase());
          router.replace(`/(auth)/verify?email=${e}`);
          return;
        }
      });
      if (!data) return;
      await setSession(data.token, data.user);
      router.replace("/(app)/notes");
      Toast.show({ type: "success", text1: "Logged in", text2: `Hello ${data.user.email}`, position: "bottom", visibilityTime: 4000 });
    } catch (error: any) {
      const message = error?.message || "Invalid credentials";
      Toast.show({ type: "error", text1: "Login failed", text2: message, position: "bottom", visibilityTime: 4000 });
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
      setUser(null);
      setToken(null);
      Toast.show({ type: "info", text1: "Signed out", position: "bottom", visibilityTime: 4000 });
    } catch {
      setUser(null);
      setToken(null);
      Toast.show({ type: "error", text1: "Sign out issue", text2: "Could not fully clear session.", position: "bottom", visibilityTime: 4000 });
    }
  };

  const resendVerification = async (email: string) => {
    await fetchJson(`${API_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    router.replace("/(auth)/login");
    Toast.show({ type: "success", text1: "Verification email sent" });
  };

  const requestPasswordReset = async (email: string) => {
    await fetchJson(`${API_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    router.replace("/(auth)/login");
    Toast.show({ type: "success", text1: "Reset link sent" });
  };

  const resetPassword = async (id: string, tokenStr: string, password: string) => {
    await fetchJson(`${API_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token: tokenStr, password }),
    });
    router.replace("/(auth)/login");
    Toast.show({ type: "success", text1: "Password updated" });
  };

  const updateEmail = async (email: string) => {
    const trimmed = String(email || "").trim().toLowerCase();
    await fetchAuthJson(`/api/user/update-email`, {
      method: "POST",
      body: JSON.stringify({ email: trimmed }),
    });
    if (user) {
      const updated = { ...user, email: trimmed };
      await AsyncStorage.setItem("@auth_user", JSON.stringify(updated));
      setUser(updated);
    }
    Toast.show({ type: "success", text1: "Email updated" });
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await fetchAuthJson(`/api/user/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    Toast.show({ type: "success", text1: "Password updated" });
  };

  const deleteAccount = async () => {
    await fetchAuthJson(`/api/user/me`, { method: "DELETE" });
    await AsyncStorage.multiRemove(["@auth_user", "@auth_token"]);
    setUser(null);
    setToken(null);
    Toast.show({ type: "success", text1: "Account deleted" });
    router.replace("/(auth)/login");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      signIn,
      register,
      signOut,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      setSession,
      updateEmail,
      changePassword,
      deleteAccount,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
