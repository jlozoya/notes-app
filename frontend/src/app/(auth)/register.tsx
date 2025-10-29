import React, { useEffect, useRef, useState } from "react";
import { Link } from "expo-router";
import { Platform, Text, TextInput, View, TouchableOpacity } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import { isEmail } from "src/utils/validators";

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
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
    else if (password.length < 8) e.password = "Use at least 8 characters.";
    if (confirm !== password) e.confirm = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    blurActive();
    if (!validate()) return;
    try {
      setSubmitting(true);
      await register(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 p-6 justify-center">
      <View className="w-full" style={{ maxWidth: 420, alignSelf: "center" }}>
        <Text className="text-3xl font-bold mb-6">Create account</Text>

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

          <Text className="mt-4 text-sm">Password</Text>
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

          <Text className="mt-4 text-sm">Confirm password</Text>
          <TextInput
            id="confirm"
            className={`border rounded-xl px-4 py-3 ${errors.confirm ? "border-red-500" : ""}`}
            secureTextEntry
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              if (errors.confirm) setErrors({ ...errors, confirm: undefined });
            }}
          />
          {!!errors.confirm && <Text className="text-xs text-red-500">{errors.confirm}</Text>}

          <Text className="text-xs text-gray-500 mt-2">
            Use at least 8 characters with a mix of letters and numbers.
          </Text>
        </View>

        <TouchableOpacity
          className="bg-black rounded-xl py-4 items-center mt-6 opacity-100"
          disabled={submitting}
          onPress={onSubmit}
        >
          <Text className="text-white font-medium">{submitting ? "Creating..." : "Sign up"}</Text>
        </TouchableOpacity>

        <Text className="text-center mt-4">
          Already have an account?{" "}
          <Link href="/(auth)/login" className="font-semibold underline" onPress={blurActive}>
            Log in
          </Link>
        </Text>
      </View>
    </View>
  );
}
