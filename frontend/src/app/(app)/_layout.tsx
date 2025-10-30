import React from "react";
import { Link, Stack, useGlobalSearchParams } from "expo-router";
import { TouchableOpacity, Text, View } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import ShareNoteButton from "@/components/ShareNoteButton";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * AppLayout (Expo Router Stack + Providers)
 * -----------------------------------------
 * Top-level layout for the `(app)` group. Wraps screens with gesture handling and
 * safe-area providers, and defines a `Stack` with per-screen header actions.
 *
 * Responsibilities
 * - Provides `GestureHandlerRootView` at the root to enable react-native-gesture-handler.
 * - Provides `SafeAreaProvider` for correct notch/inset handling across platforms.
 * - Declares three stack screens:
 *   1) `account/index` — Shows an "Account" title and a "Sign out" header action.
 *   2) `notes/index`   — Notes list screen with "Account" (navigates to account) and "Sign out".
 *   3) `notes/[id]`    — Note editor with "Share" (via `ShareNoteButton`) and "Sign out".
 *
 * Header Actions
 * - `Account` (notes/index): Navigates to `/(app)/account` using `Link asChild` with a button.
 * - `Share`   (notes/[id]): Renders `ShareNoteButton` with `noteId` from global search params.
 * - `Sign out`: Invokes `useAuth().signOut()` on all screens where present.
 *
 * Params & Data Flow
 * - Reads `id` from `useGlobalSearchParams<{ id: string }>()`. This value is passed to
 *   `ShareNoteButton` on `notes/[id]`. Ensure the `ShareNoteButton` can gracefully handle
 *   cases where `id` may be missing or not yet resolved (e.g., deep links).
 *
 * Dependencies
 * - Navigation: `expo-router` (`Stack`, `Link`, `useGlobalSearchParams`)
 * - Auth: `useAuth` from `src/providers/AuthProvider` (must expose `signOut`)
 * - UI: `react-native` (`TouchableOpacity`, `Text`, `View`)
 * - Sharing: `ShareNoteButton` (expects `noteId` and optional `label`, `className`)
 * - Providers: `react-native-gesture-handler` (`GestureHandlerRootView`),
 *              `react-native-safe-area-context` (`SafeAreaProvider`)
 *
 * Accessibility
 * - Header buttons include `accessibilityRole="button"` and `accessibilityLabel` where appropriate.
 * - Text-based buttons provide clear labels ("Account", "Sign out", "Share").
 *
 * Implementation Notes
 * - Provider order matters: `GestureHandlerRootView` must wrap the app to avoid gesture errors.
 * - `SafeAreaProvider` should wrap the navigation tree to correctly compute insets for headers.
 * - Keep header actions lightweight; heavy logic should live in screen components or hooks.
 *
 * Testing Checklist
 * - Renders the three stack screens with the expected titles.
 * - "Account" button from `notes/index` navigates to the account screen.
 * - "Share" button appears on `notes/[id]` and receives the current `id`.
 * - "Sign out" triggers `useAuth().signOut()` from any screen where present.
 * - Layout renders correctly with gesture/safe-area providers on iOS/Android/Web.
 *
 * @component
 * @returns JSX.Element App-level layout for the `(app)` stack with providers and headers.
 */
export default function AppLayout() {
  const { id } = useGlobalSearchParams<{ id: string; }>();
  const { signOut } = useAuth();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
