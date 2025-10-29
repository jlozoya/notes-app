import React, { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Platform, Text, TextInput, View, TouchableOpacity } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import { isEmail } from "src/utils/validators";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS === "web") emailRef.current?.focus?.();
  }, []);

  const blurActive = () => {
    if (Platform.OS === "web") (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!isEmail(email)) e.email = "Enter a valid email.";
    if (!password) e.password = "Password is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <View className="flex-1 p-6 justify-center">
      <View className="w-full" style={{ maxWidth: 420, alignSelf: "center" }}>
        <Text className="text-3xl font-bold mb-6">Welcome back</Text>

        <View className="gap-2">
          <Text className="text-sm">Email</Text>
          <TextInput
            ref={emailRef}
            id="email"
            className={`border rounded-xl px-4 py-3 ${errors.email ? "border-red-500" : ""}`}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
          />
          {!!errors.email && <Text className="text-xs text-red-500">{errors.email}</Text>}

          <Text className="text-sm mt-4">Password</Text>
          <TextInput
            id="password"
            className={`border rounded-xl px-4 py-3 ${errors.password ? "border-red-500" : ""}`}
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
          />
          {!!errors.password && <Text className="text-xs text-red-500">{errors.password}</Text>}

          <View className="items-end mt-2">
            <Link href="/(auth)/forgot" className="text-sm underline" onPress={blurActive}>
              Forgot password?
            </Link>
          </View>
        </View>

        <TouchableOpacity
          className="bg-black rounded-xl py-4 items-center mt-6"
          onPress={async () => {
            blurActive();
            if (!validate()) return;
            await signIn(email.trim(), password);
          }}
        >
          <Text className="text-white font-medium">Log in</Text>
        </TouchableOpacity>

        <Text className="text-center mt-4">
          Don’t have an account?{" "}
          <Link href="/(auth)/register" className="font-semibold underline" onPress={blurActive}>
            Sign up
          </Link>
        </Text>
      </View>
    </View>
  );
}
