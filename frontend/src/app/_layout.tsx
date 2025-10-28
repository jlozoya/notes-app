import 'react-native-gesture-handler';
import React, { useEffect } from "react";
import { Slot, useRouter, useSegments, useRootNavigationState, usePathname } from "expo-router";
import { AuthProvider, useAuth } from "src/providers/AuthProvider";
import { ActivityIndicator, View } from "react-native";
import Toast from "react-native-toast-message";
import "../global.css";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Head from "expo-router/head";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!navState?.key) return;
    if (!segments.length) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup && pathname !== "/(auth)/login") {
      router.replace("/(auth)/login");
      return;
    }
    if (user && inAuthGroup && pathname !== "/(app)/notes") {
      router.replace("/(app)/notes");
      return;
    }
  }, [loading, user, segments, navState?.key, pathname, router]);

  if (loading || !navState?.key) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <AuthGate>
              <Slot />
              <Toast />
            </AuthGate>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
