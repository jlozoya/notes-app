import React, { useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { RichText, Toolbar, useEditorBridge } from "@10play/tentap-editor";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  return (...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => cbRef.current(...args), delay);
  };
}

type Props = {
  initialContent?: string;
  onChangeHtml?: (html: string) => void;
};

export default function RichEditor({ initialContent, onChangeHtml }: Props) {
  const insets = useSafeAreaInsets();
  const lastAppliedHtml = useRef<string | undefined>(initialContent);

  const editorRef = useRef<ReturnType<typeof useEditorBridge> | null>(null);

  const debouncedOnChange = useDebouncedCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = await editor.getHTML();
    if (next === lastAppliedHtml.current) return;
    lastAppliedHtml.current = next;
    onChangeHtml?.(next);
  }, 500);

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    ...(initialContent ? { initialContent } : {}),
    onChange: () => {
      debouncedOnChange();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    (async () => {
      const e = editorRef.current;
      if (!e || typeof initialContent !== "string") return;
      const current = await e.getHTML();
      if (current === initialContent) return;
      await e.setContent(initialContent);
      lastAppliedHtml.current = initialContent;
    })();
  }, [initialContent]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={{ flex: 1, paddingBottom: 56 + insets.bottom }}>
        <RichText editor={editor} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom }}
      >
        <View style={{ backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
          <Toolbar editor={editor} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
