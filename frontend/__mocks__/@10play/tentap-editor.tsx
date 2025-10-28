import React from "react";
import { View } from "react-native";

type Options = { onChange?: () => void };

export const useEditorBridge = jest.fn((_opts?: Options) => {
  return {
    getHTML: jest.fn().mockResolvedValue("<p>hello</p>"),
    setContent: jest.fn().mockResolvedValue(undefined),
  };
});

export const RichText: React.FC<{ editor: any }> = () => <View testID="richtext" />;
export const Toolbar: React.FC<{ editor: any }> = () => <View testID="toolbar" />;
