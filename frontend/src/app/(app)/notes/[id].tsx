import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { TextInput, View, TouchableOpacity, Text } from "react-native";
import io from "socket.io-client";
import RichEditor from "src/components/RichEditor";

const socket = io(process.env.EXPO_PUBLIC_SOCKET_URL);

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");

  // join room
  useEffect(() => {
    if (!id) return;
    socket.emit("join", id);
    socket.on("load-note", (n) => {
      setTitle(n.title);
      setHtml(n.html);
    });
    socket.on("update", (n) => {
      setTitle(n.title);
      setHtml(n.html);
    });
    return () => {
      socket.off("load-note");
      socket.off("update");
    };
  }, [id]);

  const sendUpdate = (updated: Partial<{ title: string; html: string }>) => {
    socket.emit("edit", { id, title, html, ...updated });
  };

  return (
    <View className="flex-1">
      <TextInput
        className="text-2xl font-bold px-4 pt-4 pb-2"
        placeholder="Title"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          sendUpdate({ title: t });
        }}
      />
      <View className="flex-1 px-3">
        <RichEditor
          key={id}
          initialContent={html}
          onChangeHtml={(next) => {
            setHtml(next);
            sendUpdate({ html: next });
          }}
        />
      </View>
    </View>
  );
}
