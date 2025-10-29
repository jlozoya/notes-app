import React from "react";
import { TouchableOpacity, Text, Platform, Share as RNShare } from "react-native";
import * as Clipboard from "expo-clipboard";
import { enableShareAndGetLink } from "src/lib/share";
import Toast from "react-native-toast-message";

type Props = {
  noteId: string;
  title?: string;
  className?: string;
  label?: string;
};

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
