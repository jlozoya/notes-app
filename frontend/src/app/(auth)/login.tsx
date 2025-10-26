import React, { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Platform, Text, TextInput, View, TouchableOpacity } from "react-native";
import { useAuth } from "src/providers/AuthProvider";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      emailRef.current?.focus?.();
    }
  }, []);

  const blurActive = () => {
    if (Platform.OS === "web") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  return (
    <View className="flex-1 p-6 gap-6 justify-center">
      <Text className="text-3xl font-bold">Welcome back</Text>

      <View className="gap-3">
        <Text className="text-sm">Email</Text>
        <TextInput
          ref={emailRef}
          id="email"
          className="border rounded-xl px-4 py-3"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text className="text-sm mt-4">Password</Text>
        <TextInput
          id="password"
          className="border rounded-xl px-4 py-3"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <TouchableOpacity
        className="bg-black rounded-xl py-4 items-center"
        onPress={async () => {
          blurActive();
          await signIn(email.trim(), password);
          router.replace("/(app)/notes");
        }}
      >
        <Text className="text-white font-medium">Log in</Text>
      </TouchableOpacity>

      <Text className="text-center">
        Don’t have an account?{" "}
        <Link
          href="/(auth)/register"
          className="font-semibold underline"
          onPress={blurActive}
        >
          Create one
        </Link>
      </Text>
    </View>
  );
}
