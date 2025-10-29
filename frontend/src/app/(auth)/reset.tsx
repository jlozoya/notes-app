import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, TextInput, View, TouchableOpacity } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import { isStrongPassword } from "src/utils/validators";

export default function Reset() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSubmit =
    id && token && password === confirm && isStrongPassword(password);

  return (
    <View className="flex-1 p-6 gap-4 justify-center">
      <View className="w-full" style={{ maxWidth: 420, alignSelf: "center" }}>
        <Text className="text-3xl font-bold mb-6">Set new password</Text>

        <View className="gap-2">
          <Text className="text-sm">New password</Text>
          <TextInput
            id="password"
            className="border rounded-xl px-4 py-3"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text className="text-sm mt-4">Confirm password</Text>
          <TextInput
            id="confirm"
            className="border rounded-xl px-4 py-3"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          <TouchableOpacity
            className={`rounded-xl py-4 items-center mt-6 ${canSubmit ? "bg-black" : "bg-gray-300"}`}
            disabled={!canSubmit}
            onPress={async () => {
              await resetPassword(id as string, token as string, password);
              router.replace("/(auth)/login");
            }}
          >
            <Text className="text-white font-medium">Update password</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
