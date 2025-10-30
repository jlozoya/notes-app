import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { RichText, Toolbar, useEditorBridge } from "@10play/tentap-editor";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A small debounce utility for stable callbacks without re-creating timers.
 *
 * @template T A function type whose calls will be debounced.
 * @param callback The function to invoke after the debounce delay.
 * @param delay The debounce delay in milliseconds.
 * @returns A debounced function with the same signature as `callback`.
 */
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
  /**
   * Initial HTML string to load into the editor.
   * If `initialContent` changes and is different from the current editor HTML,
   * the editor content will be updated. Use this for one-way sync from parent state.
   */
  initialContent?: string;
  /**
   * Debounced change handler that receives the current HTML of the editor.
   * Called at most once per 500ms while the user types to reduce updates.
   */
  onChangeHtml?: (html: string) => void;
};

const TOOLBAR_HEIGHT = 56;

/**
 * RichEditor
 *
 * A cross-platform rich-text editor wrapper built on @10play/tentap-editor.
 *
 * Features
 * - One-way `initialContent` sync with change detection
 * - Debounced `onChangeHtml` (500ms)
 * - Keyboard-aware floating toolbar on native (iOS/Android)
 * - Fixed, horizontally scrollable toolbar on web
 * - Safe-area handling for devices with bottom insets
 *
 * Layout
 * - The editor area adds bottom padding equal to toolbar height + bottom inset/keyboard height
 *   to avoid overlap.
 * - The toolbar anchors above the keyboard on native, or fixed at the bottom on web.
 */
export default function RichEditor({ initialContent, onChangeHtml }: Props) {
  const insets = useSafeAreaInsets();
  const lastAppliedHtml = useRef<string | undefined>(initialContent);
  const editorRef = useRef<ReturnType<typeof useEditorBridge> | null>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const isKbOpen = kbHeight > 0;
  const toolbarBottom = isKbOpen ? kbHeight : insets.bottom;
  const editorBottomPadding = TOOLBAR_HEIGHT + toolbarBottom;
  const isWeb = Platform.OS === "web";

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
    onChange: () => debouncedOnChange(),
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

  useEffect(() => {
    const onShow = (e: any) => setKbHeight(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);

    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, paddingBottom: editorBottomPadding }}>
        <RichText editor={editor} />
      </View>

      <View
        style={[
          {
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            backgroundColor: "#fff",
            minHeight: TOOLBAR_HEIGHT,
            justifyContent: "center",
          },
          isWeb
            ? {
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "env(safe-area-inset-bottom)" as any,
                zIndex: 1000,
                ...( {
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                } as any ),
              }
            : {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: toolbarBottom,
                elevation: 8,
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: -2 },
                paddingBottom: Math.max(insets.bottom, 8),
              },
        ]}
      >
        <View
          style={{
            ...(isWeb ? ({ display: "inline-flex" } as any) : {}),
            flexDirection: "row",
            flexWrap: "nowrap",
            gap: 4,
            paddingHorizontal: 8,
            width: "100%",
            maxWidth: isWeb ? ("100vw" as any) : undefined,
          }}
        >
          <Toolbar editor={editor} />
        </View>
      </View>
    </SafeAreaView>
  );
}
