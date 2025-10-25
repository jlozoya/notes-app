import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { TextInput, View, TouchableOpacity, Text, Alert } from "react-native";
import RichEditor from "@/components/RichEditor";
import { getNote, upsertNote } from "@/lib/notes";

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalHtml, setOriginalHtml] = useState("");

  const dirty = useMemo(
    () => (title.trim() !== (originalTitle ?? "").trim()) || (html ?? "") !== (originalHtml ?? ""),
    [title, html, originalTitle, originalHtml]
  );

  useEffect(() => {
    (async () => {
      if (!id) return;
      const n = await getNote(id);
      setTitle(n?.title ?? "");
      setHtml(n?.html ?? "");
      setOriginalTitle(n?.title ?? "");
      setOriginalHtml(n?.html ?? "");
    })();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    await upsertNote({
      id,
      title: title.trim() || "Untitled",
      html,
      updatedAt: Date.now(),
    });
    setOriginalTitle(title.trim() || "Untitled");
    setOriginalHtml(html);
    Alert.alert("Saved", "Your note has been saved.");
    router.back();
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          className={`px-3 py-1 ${dirty ? "" : "opacity-40"}`}
          disabled={!dirty}
          onPress={handleSave}
        >
          <Text className="font-medium">Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, dirty, title, html]);

  return (
    <View className="flex-1">
      <TextInput
        className="text-2xl font-bold px-4 pt-4 pb-2"
        placeholder="Title"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
      />

      <View className="flex-1 px-3">
        <RichEditor
          key={id}
          initialContent={html}
          onChangeHtml={setHtml}
        />
      </View>
    </View>
  );
}
