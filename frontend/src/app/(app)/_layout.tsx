import React from "react";
import { Link, Stack, useGlobalSearchParams } from "expo-router";
import { TouchableOpacity, Text, View } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import ShareNoteButton from "@/components/ShareNoteButton";

export default function AppLayout() {
  const { id } = useGlobalSearchParams<{ id: string; }>();
  const { signOut } = useAuth();

  return (
    <Stack>
      <Stack.Screen
        name="account/index"
        options={{
          title: "Account",
          headerRight: () => (
            <TouchableOpacity className="px-3 py-1" onPress={signOut}>
              <Text className="font-medium">Sign out</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="notes/index"
        options={{
          title: "Notes",
          headerRight: () => (
            <View className="flex-row items-center">
              <Link href="/(app)/account" asChild>
                <TouchableOpacity className="px-3 py-1" accessibilityRole="button" accessibilityLabel="Open account">
                  <Text className="font-medium">Account</Text>
                </TouchableOpacity>
              </Link>
              <TouchableOpacity className="px-3 py-1" onPress={signOut} accessibilityRole="button" accessibilityLabel="Sign out">
                <Text className="font-medium">Sign out</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="notes/[id]"
        options={{
          title: "Edit note",
          headerRight: () => (
            <View className="flex-row items-center">
              <ShareNoteButton noteId={id} label="Share" className="px-3 py-1" />
              <TouchableOpacity className="px-3 py-1" onPress={signOut} accessibilityRole="button" accessibilityLabel="Sign out">
                <Text className="font-medium">Sign out</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
    </Stack>
  );
}
