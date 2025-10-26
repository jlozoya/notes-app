import AsyncStorage from "@react-native-async-storage/async-storage";

export type Note = {
  id: string;
  title: string;
  html: string;
  updatedAt: number
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000";
const CACHE_KEY = "@notes_cache";

/** Tiny fetch helper with timeout + JSON/error handling */
async function fetchJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
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
    if (err?.name === "AbortError") throw new Error("Request timed out. Check your connection.");
    if (err?.message?.includes("Network request failed")) {
      throw new Error("Network error. Is the API reachable?");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

async function authHeaders() {
  const token = await AsyncStorage.getItem("@auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Map server -> client */
function mapFromServer(n: any): Note {
  return {
    id: n._id || n.id,
    title: n.title ?? "Untitled",
    html: n.html ?? "",
    updatedAt: n.updatedAt ? new Date(n.updatedAt).getTime() : Date.now(),
  };
}

/** Map client -> server */
function mapToServer(n: Partial<Note>) {
  const payload: any = {
    title: n.title ?? "Untitled",
    html: n.html ?? "",
  };
  if (n.updatedAt) payload.updatedAt = new Date(n.updatedAt).toISOString();
  return payload;
}

/** --------- API: LIST --------- */
export async function getNotes(): Promise<Note[]> {
  try {
    const notes = await fetchJson<any[]>("/api/notes", {
      method: "GET",
      headers: await authHeaders(),
    });
    const mapped = notes.map(mapFromServer);
    // cache for offline
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
    return mapped;
  } catch (e) {
    // offline fallback
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      try { return JSON.parse(raw) as Note[]; } catch {}
    }
    throw e;
  }
}

/** --------- API: GET ONE --------- */
export async function getNote(id: string): Promise<Note | undefined> {
  try {
    const n = await fetchJson<any>(`/api/notes/${id}`, {
      method: "GET",
      headers: await authHeaders(),
    });
    return mapFromServer(n);
  } catch (e) {
    // fallback: search in cache
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        const list: Note[] = JSON.parse(raw);
        return list.find((x) => x.id === id);
      } catch {}
    }
    throw e;
  }
}

/** --------- API: CREATE / UPDATE ---------
 * If note.id looks like a Mongo ObjectId => PUT
 * Else => POST (server will issue a new _id)
 */
function looksLikeObjectId(id?: string) {
  return !!id && /^[a-f0-9]{24}$/i.test(id);
}

export async function upsertNote(note: Note): Promise<Note> {
  const now = Date.now();
  const body = JSON.stringify(mapToServer({ ...note, updatedAt: now }));

  if (looksLikeObjectId(note.id)) {
    // UPDATE
    const updated = await fetchJson<any>(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: await authHeaders(),
      body,
    });
    const mapped = mapFromServer(updated);
    // update cache
    const list = await getNotesSafelyFromCache();
    await writeNotesCache(upsertInArray(list, mapped));
    return mapped;
  } else {
    // CREATE (ignore client id; server creates _id)
    const created = await fetchJson<any>("/api/notes", {
      method: "POST",
      headers: await authHeaders(),
      body,
    });
    const mapped = mapFromServer(created);
    const list = await getNotesSafelyFromCache();
    await writeNotesCache([mapped, ...list]);
    return mapped;
  }
}

/** --------- API: DELETE --------- */
export async function deleteNote(id: string) {
  await fetchJson(`/api/notes/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const list = await getNotesSafelyFromCache();
  await writeNotesCache(list.filter((n) => n.id !== id));
}

/** --------- Cache helpers --------- */
async function getNotesSafelyFromCache(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Note[]; } catch { return []; }
}
async function writeNotesCache(list: Note[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
}
function upsertInArray(list: Note[], n: Note) {
  const idx = list.findIndex((x) => x.id === n.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = n;
    return next.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return [n, ...list].sort((a, b) => b.updatedAt - a.updatedAt);
}
