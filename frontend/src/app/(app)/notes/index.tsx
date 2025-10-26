import React from "react";
import { Link, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, Platform, Text, TouchableOpacity, View } from "react-native";
import { deleteNote, getNotes, Note, upsertNote } from "src/lib/notes";


export default function NotesList() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(false);

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
      return () => { active = false; };
    }, [load])
  );

  const blurActive = () => {
    if (Platform.OS === "web") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  const createNote = async () => {
    const id = Date.now().toString();
    const newNote: Note = { id, title: "Untitled", html: "", updatedAt: Date.now() };
    await upsertNote(newNote);

    setNotes(prev => {
      const exists = prev.some(n => n.id === id);
      const next = exists ? prev.map(n => (n.id === id ? newNote : n)) : [newNote, ...prev];
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });

    router.push(`/(app)/notes/${id}`);
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
            <Link
              href={`/(app)/notes/${item.id}`}
              asChild
              onPress={blurActive}
            >
              <TouchableOpacity className="flex-1 pr-3">
                <Text className="text-base font-medium">{item.title || "Untitled"}</Text>
                <Text className="text-xs text-gray-500">
                  {new Date(item.updatedAt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            </Link>

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
