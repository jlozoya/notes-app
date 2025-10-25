import AsyncStorage from "@react-native-async-storage/async-storage";

export type Note = { id: string; title: string; html: string; updatedAt: number };

const KEY = "@demo_notes";

export async function getNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function getNote(id: string): Promise<Note | undefined> {
  const all = await getNotes();
  return all.find(n => n.id === id);
}

export async function upsertNote(note: Note) {
  const all = await getNotes();
  const idx = all.findIndex(n => n.id === note.id);
  if (idx >= 0) all[idx] = note; else all.unshift(note);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deleteNote(id: string) {
  const all = await getNotes();
  const kept = all.filter(n => n.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(kept));
}
