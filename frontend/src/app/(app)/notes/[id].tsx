import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { TextInput, View } from "react-native";
import io, { Socket } from "socket.io-client";
import RichEditor from "src/components/RichEditor";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL as string | undefined;
const isObjectId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);
let socket: Socket | null = null;

function getSocket() {
  if (!SOCKET_URL) {
    console.warn("EXPO_PUBLIC_API_URL is missing");
    return null;
  }
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      auth: async (cb) => {
        const token = await AsyncStorage.getItem("@auth_token");
        cb({ token });
      },
    });
  }
  return socket;
}

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");

  const latest = useRef({ title: "", html: "" });
  useEffect(() => {
    latest.current = { title, html };
  }, [title, html]);

  useEffect(() => {
    const socket = getSocket();
    console.log(socket, id);
    if (!socket) return;
    if (!id || !isObjectId(id)) {
      console.warn("NoteEditor: invalid id, skipping socket join:", id);
      return;
    }

    const onLoad = (n: { title?: string; html?: string }) => {
      if (typeof n.title === "string") setTitle(n.title);
      if (typeof n.html === "string") setHtml(n.html);
    };

    const onUpdate = (n: { title?: string; html?: string }) => {
      if (typeof n.title === "string") setTitle(n.title);
      if (typeof n.html === "string") setHtml(n.html);
    };

    const onSocketError = (payload: { message?: string }) => {
      console.warn("socket-error:", payload?.message || "Unknown socket error");
    };

    socket.emit("join", id);
    socket.on("load-note", onLoad);
    socket.on("update", onUpdate);
    socket.on("socket-error", onSocketError);

    return () => {
      socket.off("load-note", onLoad);
      socket.off("update", onUpdate);
      socket.off("socket-error", onSocketError);
      socket.emit("leave", id);
    };
  }, [id]);

  const sendUpdate = (partial: Partial<{ title: string; html: string }>) => {
    const socket = getSocket();
    if (!socket || !id || !isObjectId(id)) return;
    const payload = {
      id,
      title: partial.title ?? latest.current.title,
      html: partial.html ?? latest.current.html,
    };
    socket.emit("edit", payload);
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
