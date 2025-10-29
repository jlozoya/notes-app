import React, { useState } from "react";
import { Text, TextInput, View, TouchableOpacity } from "react-native";
import { useAuth } from "src/providers/AuthProvider";
import { isEmail } from "src/utils/validators";

export default function Forgot() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");

  return (
    <View className="flex-1 p-6 gap-4 justify-center">
      <View className="w-full" style={{ maxWidth: 420, alignSelf: "center" }}>
        <Text className="text-3xl font-bold mb-6">Reset password</Text>
        <View className="gap-2">
          <Text className="text-gray-700">Enter your email to get a reset link.</Text>

          <Text className="text-sm mt-2">Email</Text>
          <TextInput
            id="email"
            className="border rounded-xl px-4 py-3"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity
            className="bg-black rounded-xl py-4 items-center mt-6"
            onPress={() => isEmail(email) && requestPasswordReset(email)}
          >
            <Text className="text-white font-medium">Send reset link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
