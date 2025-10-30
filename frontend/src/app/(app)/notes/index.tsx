import React from "react";
import { Link, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, Platform, Text, TouchableOpacity, View } from "react-native";
import { deleteNote, getNotes, Note, upsertNote } from "src/lib/notes";
import ShareNoteButton from "@/components/ShareNoteButton";

/**
 * NotesList (React Native + Expo Router)
 * --------------------------------------
 * Displays the user’s notes in a sortable, refreshable list with actions to create,
 * open, share, and delete notes. Automatically reloads on screen focus.
 *
 * Features
 * - Fetch & sort: Retrieves notes via `getNotes()` and sorts by `updatedAt` (desc).
 * - Pull-to-refresh: Uses `FlatList` with `refreshing` and `onRefresh`.
 * - Create note: Persists a draft via `upsertNote()` and navigates to its editor.
 * - Navigate to note: Opens `/(app)/notes/:id` using `Link` / `router`.
 * - Share: Renders `ShareNoteButton` per row with `noteId` and `title`.
 * - Delete: Calls `deleteNote()` then reloads the list.
 * - Focus-aware: Re-fetches when the screen gains focus (`useFocusEffect`).
 * - Web UX: Blurs the active element on link press to avoid lingering focus.
 *
 * Data Contract
 * - Note shape: `{ id: string; title: string; html: string; updatedAt: number }`
 * - Data layer functions (from `src/lib/notes`):
 *   - `getNotes(): Promise<Note[]>`
 *   - `upsertNote(note: Note): Promise<Note>`
 *   - `deleteNote(id: string): Promise<void>`
 *
 * Dependencies
 * - Navigation: `expo-router` (`Link`, `router`)
 * - Lifecycle: `@react-navigation/native` (`useFocusEffect`)
 * - UI: `react-native` (`FlatList`, `View`, `Text`, `TouchableOpacity`, `Platform`)
 * - Share: `ShareNoteButton`
 *
 * Side Effects
 * - Network calls in `load()`/`createNote()`/`deleteNote()`
 * - Navigation via `router.push` and `Link`
 * - DOM focus manipulation on web (`document.activeElement.blur()`)
 *
 * Error Handling
 * - `load()` resets `loading` in a `finally` block.
 * - Surface additional failures (create/delete) via your app’s toast/snackbar if desired.
 *
 * @component
 * @returns JSX.Element Notes list screen.
 */
export default function NotesList() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(false);

  /**
   * Fetches notes, sorts them by `updatedAt` descending, and updates local state.
   * Sets a loading flag during the request and ensures it is cleared in `finally`.
   *
   * Triggered on:
   * - Screen focus via `useFocusEffect`
   * - Pull-to-refresh (`FlatList.onRefresh`)
   *
   * @returns Promise<void>
   */
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotes();
      data.sort((a, b) => b.updatedAt - a.updatedAt);
      setNotes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await load();
      })();
      return () => {
        active = false;
      };
    }, [load])
  );

  /**
   * Web-only utility to blur the currently focused element (if any) to prevent lingering
   * focus outlines or virtual keyboard issues after tapping a list item.
   *
   * No-op on native platforms.
   *
   * @returns void
   */
  const blurActive = () => {
    if (Platform.OS === "web") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  /**
   * Creates a new draft note (`"Untitled"`, empty HTML, `Date.now()`), persists it using
   * `upsertNote()`, merges it into the local list (idempotently), re-sorts the list, and
   * navigates to `/(app)/notes/{id}`.
   *
   * @returns Promise<void>
   */
  const createNote = async () => {
    const draft: Note = { id: "", title: "Untitled", html: "", updatedAt: Date.now() };
    const saved = await upsertNote(draft);

    setNotes((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      const next = exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });

    router.push(`/(app)/notes/${saved.id}`);
  };

  return (
    <View className="flex-1 p-4 gap-4">
      <TouchableOpacity className="bg-black rounded-xl py-3 items-center" onPress={createNote}>
        <Text className="text-white font-medium">New note</Text>
      </TouchableOpacity>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        refreshing={loading}
        onRefresh={load}
        ItemSeparatorComponent={() => <View className="h-[1px] bg-gray-200" />}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between py-3">
            <Link href={`/(app)/notes/${item.id}`} asChild onPress={blurActive}>
              <TouchableOpacity className="flex-1 pr-3">
                <Text className="text-base font-medium">{item.title || "Untitled"}</Text>
                <Text className="text-xs text-gray-500">
                  {new Date(item.updatedAt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            </Link>

            <ShareNoteButton noteId={item.id} title={item.title} />

            <TouchableOpacity
              className="px-3 py-2"
              onPress={async () => {
                await deleteNote(item.id);
                await load();
              }}
            >
              <Text className="text-red-600">Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
