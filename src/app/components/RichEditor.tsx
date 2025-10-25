import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { RichText, Toolbar, useEditorBridge, EditorBridge } from '@10play/tentap-editor';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const debounce = <T extends (...args: any[]) => void>(fn: T, ms = 250) => {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

type Props = { initialContent?: string; onChangeHtml?: (html: string) => void };

function RichEditorInner({ initialContent, onChangeHtml }: Props) {
  const insets = useSafeAreaInsets();
  const [html, setHtml] = useState(initialContent ?? '');

  const handleChange = useMemo(
    () =>
      debounce(async (bridge: EditorBridge) => {
        const next = await bridge.getHTML();
        setHtml(next);
        onChangeHtml?.(next);
      }, 500),
    [onChangeHtml]
  );

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    ...(initialContent ? { initialContent } : {}),
    onChange: () => handleChange(editor),
  });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <RichText editor={editor} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom }}
      >
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
          <Toolbar editor={editor} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function RichEditor(props: Props) {
  return (
    <SafeAreaProvider>
      <RichEditorInner {...props} />
    </SafeAreaProvider>
  );
}
