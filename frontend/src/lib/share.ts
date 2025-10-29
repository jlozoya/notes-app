import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const PUBLIC_WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE;

function getWebBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  if (PUBLIC_WEB_BASE) return PUBLIC_WEB_BASE.replace(/\/$/, "");
  if (API_BASE) {
    try {
      const u = new URL(API_BASE);
      return u.origin;
    } catch {}
  }
  return "https://";
}

export async function enableShareAndGetLink(noteId: string, title?: string) {
  if (!API_BASE) throw new Error("Missing EXPO_PUBLIC_API_URL");
  const token = await AsyncStorage.getItem("@auth_token");

  const res = await fetch(`${API_BASE}/api/notes/${noteId}/share/public`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ enable: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to enable sharing");
  }

  const base = getWebBase();
  const link = `${base}/notes/${noteId}?code=${data.shareCode}`;
  return { link, title: title || "Shared note" };
}
