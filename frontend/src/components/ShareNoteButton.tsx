import React from "react";
import { TouchableOpacity, Text, Platform, Share as RNShare } from "react-native";
import * as Clipboard from "expo-clipboard";
import { enableShareAndGetLink } from "src/lib/share";
import Toast from "react-native-toast-message";

/**
 * ShareNoteButton
 *
 * Cross-platform share button that:
 * - Calls `enableShareAndGetLink(noteId, title)` to enable sharing and obtain a URL
 * - Web: uses Web Share API if available; otherwise copies the link and shows a toast
 * - Native (iOS/Android): opens the system share sheet via `Share.share`
 *
 * Dependencies:
 * - expo-clipboard (web fallback copy)
 * - react-native-toast-message (UX feedback)
 *
 * Example:
 * ```tsx
 * <ShareNoteButton noteId="abc123" title="Project notes" label="Share" />
 * ```
 */
type Props = {
  /** Note identifier used by `enableShareAndGetLink` to generate/enable a shareable link. */
  noteId: string;
  /** Optional title shown in native/web share sheets. */
  title?: string;
  /** Optional className for styling (e.g., Tailwind / RNW). */
  className?: string;
  /** Button text label. Defaults to "Share". */
  label?: string;
};

/**
 * When pressed, attempts to:
 * 1) Enable sharing and fetch a link (`enableShareAndGetLink`)
 * 2) Share the link using:
 *    - Web: `navigator.share` if available; otherwise copy to clipboard + toast
 *    - iOS/Android: `Share.share` native sheet
 * On failure, shows a bottom error toast.
 */
export default function ShareNoteButton({ noteId, title, className, label = "Share" }: Props) {
  const onShare = React.useCallback(async () => {
    try {
      const { link, title: t } = await enableShareAndGetLink(noteId, title);

      if (Platform.OS === "web") {
        const nav = globalThis?.navigator as Navigator & { share?: (data: any) => Promise<void> };
        if (nav?.share) {
          await nav.share({ title: t, url: link });
        } else {
          await Clipboard.setStringAsync(link);
          Toast.show({
            type: "success",
            text1: "Link copied to clipboard",
            position: "bottom",
            visibilityTime: 4000,
          });
        }
      } else {
        await RNShare.share({ message: link, title: t });
      }
    } catch (error: any) {
      const msg = error?.message || "Failed to share";
      Toast.show({
        type: "error",
        text1: msg,
        position: "bottom",
        visibilityTime: 4000,
      });
    }
  }, [noteId, title]);

  return (
    <TouchableOpacity className={className ?? "px-3 py-2"} onPress={onShare}>
      <Text className="text-blue-600">{label}</Text>
    </TouchableOpacity>
  );
}
