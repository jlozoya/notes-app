import React, { useEffect, useState } from "react";
import { Text, TextInput, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "src/providers/AuthProvider";
import { isEmail } from "src/utils/validators";

function isLikelyJwt(token?: string) {
  return !!token && /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token);
}

export default function Verify() {
  const { email: emailParam, token: tokenParam, id: idParam } =
    useLocalSearchParams<{ email?: string; token?: string; id?: string }>();

  const { resendVerification, setSession } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState<string>(emailParam ? String(emailParam) : "");
  const [autoSigningIn, setAutoSigningIn] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    (async () => {
      const email = (emailParam ? decodeURIComponent(String(emailParam)) : "").trim().toLowerCase();
      const token = tokenParam ? String(tokenParam) : "";
      const id = idParam ? String(idParam) : "";

      if (email && id && isLikelyJwt(token)) {
        try {
          setAutoSigningIn(true);
          await setSession(token, { id, email });
          router.replace("/(app)/notes");
        } finally {
          setAutoSigningIn(false);
        }
      }
    })();
  }, [emailParam, tokenParam, idParam]);

  const onResend = async () => {
    const normalized = email.trim().toLowerCase();
    if (!isEmail(normalized)) return;
    try {
      setResending(true);
      await resendVerification(normalized);
    } finally {
      setResending(false);
    }
  };

  return (
    <View className="flex-1 p-6 gap-4 justify-center">
      <View className="w-full" style={{ maxWidth: 420, alignSelf: "center" }}>
        <Text className="text-3xl font-bold mb-6">Verify your email</Text>

        <View className="gap-2">
          {autoSigningIn ? (
            <View className="items-center mb-6">
              <ActivityIndicator />
              <Text className="mt-3 text-gray-700 text-center">
                Finalizing verification…
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-gray-700 mb-2">
                We sent a verification link. Open it on this device to complete the process.
              </Text>

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
                onPress={onResend}
                disabled={resending || !isEmail(email.trim().toLowerCase())}
              >
                <Text className="text-white font-medium">
                  {resending ? "Sending…" : "Resend verification"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
