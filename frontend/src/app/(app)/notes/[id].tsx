import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { TextInput, View } from "react-native";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RichEditor from "src/components/RichEditor";

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL as string | undefined;
const isObjectId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

let socketSingleton: Socket | null = null;

async function getOrCreateSocket(): Promise<Socket | null> {
  if (!SOCKET_URL) {
    console.warn("EXPO_PUBLIC_API_URL is missing");
    return null;
  }
  if (socketSingleton?.connected || socketSingleton?.disconnected === false) {
    return socketSingleton!;
  }
  const token = await AsyncStorage.getItem("@auth_token");
  socketSingleton = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    auth: { token },
  });
  return socketSingleton!;
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
    let socket: Socket | null = null;
    let mounted = true;

    (async () => {
      if (!id || !isObjectId(id)) {
        console.warn("NoteEditor: invalid id, skipping socket join:", id);
        return;
      }

      socket = await getOrCreateSocket();
      if (!mounted || !socket) return;

      const onLoad = (note: { title?: string; html?: string }) => {
        if (typeof note.title === "string") setTitle(note.title);
        if (typeof note.html === "string") setHtml(note.html);
      };
      const onUpdate = (note: { title?: string; html?: string }) => {
        if (typeof note.title === "string") setTitle(note.title);
        if (typeof note.html === "string") setHtml(note.html);
      };
      const onSocketError = (payload: { message?: string }) => {
        console.warn("socket-error:", payload?.message || "Unknown socket error");
      };

      socket.on("load-note", onLoad);
      socket.on("update", onUpdate);
      socket.on("socket-error", onSocketError);

      const joinRoom = () => {
        socket!.emit("join", id, (ok: boolean, msg?: string) => {
          if (!ok) {
            console.warn("join failed:", msg);
          }
        });
      };

      if (socket.connected) {
        joinRoom();
      } else {
        socket.once("connect", joinRoom);
      }
    })();

    return () => {
      mounted = false;
      if (socket && id && isObjectId(id)) {
        socket.emit("leave", id, () => {});
        socket.off("load-note");
        socket.off("update");
        socket.off("socket-error");
      }
    };
  }, [id]);

  const sendUpdate = async (partial: Partial<{ title: string; html: string }>) => {
    if (!id || !isObjectId(id)) return;
    const socket = await getOrCreateSocket();
    if (!socket) return;
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
