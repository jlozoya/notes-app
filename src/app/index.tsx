import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { Platform } from "react-native";

if (Platform.OS === "web") {
  require("../global.css");
}
export default function Index() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/(app)/notes");
    else router.replace("/(auth)/login");
  }, [user]);

  return null;
}
