import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useGlobalSearchParams, router } from "expo-router";
import { TextInput, View } from "react-native";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
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
  if (socketSingleton) {
    if (!socketSingleton.connected && socketSingleton.disconnected) {
      try {
        socketSingleton.connect();
      } catch {}
    }
    return socketSingleton;
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
  return socketSingleton;
}

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { code } = useGlobalSearchParams<{ code?: string }>();
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");

  const latest = useRef({ title: "", html: "" });
  useEffect(() => {
    latest.current = { title, html };
  }, [title, html]);

  const emitTimer = useRef<NodeJS.Timeout | null>(null);
  const navigatedAway = useRef(false);

  const denyAndExit = (msg?: string) => {
    if (navigatedAway.current) return;
    navigatedAway.current = true;
    router.replace("/(app)/notes");
    Toast.show({
      type: "error",
      text1: "You don't have access",
      text2: msg || "You are not authorized to view this note",
      topOffset: 60,
      visibilityTime: 2500,
    });
  };

  useEffect(() => {
    let socket: Socket | null = null;
    let mounted = true;

    (async () => {
      if (!id || !isObjectId(id)) {
        console.warn("NoteEditor: invalid id, skipping socket join:", id);
        denyAndExit("The note id is not valid.");
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
        const m = payload?.message || "Unknown socket error";
        console.warn("socket-error:", m);
        if (/access denied|not found|invalid note id/i.test(m)) {
          denyAndExit(m);
        } else {
          Toast.show({ type: "error", text1: "Error", text2: m });
        }
      };
      const onConnectError = (err: any) => {
        console.warn("socket connect_error:", err?.message || err);
      };
      const onReconnect = () => {
        if (id && isObjectId(id) && !navigatedAway.current) {
          joinRoom();
        }
      };

      socket.on("load-note", onLoad);
      socket.on("update", onUpdate);
      socket.on("socket-error", onSocketError);
      socket.on("connect_error", onConnectError);
      socket.on("reconnect", onReconnect);

      const joinRoom = () => {
        socket!.emit(
          "join",
          id,
          { shareCode: code },
          (ok: boolean, msg?: string) => {
            if (!ok) {
              console.log("Join failed:", msg);
              denyAndExit(msg || "You are not authorized to view this note");
            }
          }
        );
      };

      if (socket.connected) {
        joinRoom();
      } else {
        socket.once("connect", joinRoom);
      }
    })();

    return () => {
      mounted = false;
      if (emitTimer.current) {
        clearTimeout(emitTimer.current);
        emitTimer.current = null;
      }
      if (socket && id && isObjectId(id)) {
        socket.emit("leave", id, () => {});
        socket.off("load-note");
        socket.off("update");
        socket.off("socket-error");
        socket.off("connect_error");
        socket.off("reconnect");
      }
    };
  }, [id, code]);

  const sendUpdate = async (partial: Partial<{ title: string; html: string }>) => {
    if (!id || !isObjectId(id) || navigatedAway.current) return;
    const socket = await getOrCreateSocket();
    if (!socket) return;

    const merged = {
      title: partial.title ?? latest.current.title,
      html: partial.html ?? latest.current.html,
    };
    latest.current = merged;

    if (emitTimer.current) clearTimeout(emitTimer.current);
    emitTimer.current = setTimeout(() => {
      if (!navigatedAway.current) {
        socket.emit("edit", { id, ...latest.current });
      }
    }, 120);
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
